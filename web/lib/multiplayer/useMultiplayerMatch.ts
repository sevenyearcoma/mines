"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bridge, type BoardSnapshot, type GameStats } from "@/game/bridge";
import { useMatchStore } from "@/lib/store/match";
import type { RoundResult } from "@/lib/engine";
import {
  disposeSocket,
  getSocket,
  reconnectSocket,
  type ConnectionState,
  type GameSocket,
} from "./socket";
import type { CellEvent, PlayerHandle, ScoreSnapshot } from "./protocol";

function inviteUrl(token: string): string {
  if (typeof window === "undefined") return `/match?invite=${token}`;
  const url = new URL("/match", window.location.origin);
  url.searchParams.set("invite", token);
  return url.toString();
}

const SCORE_TICK_INTERVAL_MS = 250;

export interface InviteState {
  token: string | null;
  url: string | null;
  ttlMs: number | null;
  targetUserId: string | null;
  role: "host" | "joiner" | null;
}

function emptyInvite(): InviteState {
  return {
    token: null,
    url: null,
    ttlMs: null,
    targetUserId: null,
    role: null,
  };
}

export interface ChallengeState {
  incoming: {
    challengeId: string;
    from: PlayerHandle;
    ttlMs: number;
  } | null;
  outgoing: {
    challengeId: string;
    to: PlayerHandle;
    ttlMs: number;
  } | null;
}

export interface UseMultiplayerMatch {
  status: ReturnType<typeof useMatchStore.getState>["status"];
  snapshot: ReturnType<typeof useMatchStore.getState>["snapshot"];
  currentRound: ReturnType<typeof useMatchStore.getState>["currentRound"];
  lastRoundEnd: ReturnType<typeof useMatchStore.getState>["lastRoundEnd"];
  opponentLive: ReturnType<typeof useMatchStore.getState>["opponentLive"];
  spectating: ReturnType<typeof useMatchStore.getState>["spectating"];
  ownDeadSnapshot: ReturnType<typeof useMatchStore.getState>["ownDeadSnapshot"];
  errorMessage: string | null;
  connectionState: ConnectionState;
  invite: InviteState;
  challenge: ChallengeState;
  findMatch: () => void;
  retryConnection: () => void;
  leaveMatch: () => void;
  cancelSearch: () => void;
  createInvite: () => void;
  cancelInvite: () => void;
  joinInvite: (token: string) => void;
  challengeFriend: (userId: string) => void;
  respondChallenge: (challengeId: string, accept: boolean) => void;
  cancelChallenge: (challengeId: string) => void;
}

export function useMultiplayerMatch(): UseMultiplayerMatch {
  const status = useMatchStore((s) => s.status);
  const snapshot = useMatchStore((s) => s.snapshot);
  const currentRound = useMatchStore((s) => s.currentRound);
  const lastRoundEnd = useMatchStore((s) => s.lastRoundEnd);
  const opponentLive = useMatchStore((s) => s.opponentLive);
  const spectating = useMatchStore((s) => s.spectating);
  const ownDeadSnapshot = useMatchStore((s) => s.ownDeadSnapshot);
  const errorMessage = useMatchStore((s) => s.errorMessage);

  const socketRef = useRef<GameSocket | null>(null);
  const roundIndexRef = useRef<number>(0);
  const lastTickAtRef = useRef<number>(0);
  const [invite, setInvite] = useState<InviteState>(emptyInvite);
  const [challenge, setChallenge] = useState<ChallengeState>({
    incoming: null,
    outgoing: null,
  });
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  // Subscribe to the global connection lifecycle (emitted from socket.ts) so
  // every lobby/UI element renders identically without prop-drilling. Also
  // re-emits `queue:join` after a recovered drop so the server's queue slot
  // (which may have been evicted) refills before a friend tries to pair.
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onConnection = (e: Event) => {
      const detail = (e as CustomEvent<{ state: ConnectionState }>).detail;
      if (!detail?.state) return;
      setConnectionState(detail.state);

      if (detail.state === "offline" || detail.state === "connecting") {
        wasOfflineRef.current = true;
        return;
      }
      // Just came back online after being offline.
      if (detail.state === "online" && wasOfflineRef.current) {
        wasOfflineRef.current = false;
        const status = useMatchStore.getState().status;
        const s = socketRef.current;
        if (status === "searching" && s?.connected) {
          // Server may have dropped us out of the queue during the disconnect.
          // Tell it we're still looking.
          s.emit("queue:join");
        }
      }
    };
    window.addEventListener("mines:connection", onConnection);
    return () => window.removeEventListener("mines:connection", onConnection);
  }, []);

  // Mount: connect socket, wire all listeners. Unmount: tear it all down.
  useEffect(() => {
    let cancelled = false;
    const store = useMatchStore;

    const cleanupBridge = wireBridgeListeners({
      socketRef,
      roundIndexRef,
      lastTickAtRef,
    });

    (async () => {
      let socket: GameSocket;
      try {
        socket = await getSocket();
      } catch (err) {
        if (cancelled) return;
        store.getState().setError(
          err instanceof Error ? err.message : "Failed to connect",
        );
        return;
      }
      if (cancelled) {
        disposeSocket();
        return;
      }
      socketRef.current = socket;

      socket.on("connect", () => {
        if ((socket as GameSocket & { __minesReady?: boolean }).__minesReady) {
          store.getState().clearError();
          socket.emit("match:social:sync");
        }
      });

      socket.on("queue:status", ({ queued }) => {
        if (queued) store.getState().setSearching();
      });

      socket.on("match:start", (p) => {
        roundIndexRef.current = 0;
        setChallenge({ incoming: null, outgoing: null });
        setInvite(emptyInvite());
        store.getState().applyMatchStart(p);
      });

      socket.on("match:roundStart", (p) => {
        roundIndexRef.current = p.roundIndex;
        lastTickAtRef.current = 0;
        store.getState().setCurrentRound(p.config);
        // Let React mount/swap PhaserGame before the imperative scene command.
        window.setTimeout(() => {
          if (!cancelled) bridge.emit("cmd:loadRound", p.config);
        }, 0);
      });

      socket.on("match:opponentScore", (p) => {
        const { roundIndex: _ignored, ...snap } = p;
        void _ignored;
        store.getState().setOpponentLive(snap);
      });

      socket.on("match:roundEnd", (p) => {
        store.getState().applyRoundEnd(p);
        store.getState().setOpponentLive(null);
      });

      socket.on("match:spectateStart", (p) => {
        // Server has confirmed we may now watch the opponent. Tell Phaser to
        // wipe local board + apply the full backlog, then mark us spectating.
        bridge.emit("cmd:enterSpectator", { opponentName: p.opponentName });
        if (p.events.length) bridge.emit("cmd:applyRemoteEvents", p.events);
        store.getState().setSpectating({ opponentName: p.opponentName });
      });

      socket.on("match:opponentCellEvents", (p) => {
        bridge.emit("cmd:applyRemoteEvents", p.events);
      });

      socket.on("match:invite:ready", ({ token, ttlMs, targetUserId }) => {
        const role = targetUserId ? null : "host";
        setInvite({
          token,
          url: inviteUrl(token),
          ttlMs,
          targetUserId: targetUserId ?? null,
          role,
        });
        if (role === "host") store.getState().setSearching();
      });

      socket.on("match:challenge:incoming", ({ challengeId, from, ttlMs }) => {
        setChallenge((prev) => ({
          ...prev,
          incoming: { challengeId, from, ttlMs },
        }));
      });

      socket.on("match:challenge:pending", ({ challengeId, to, ttlMs }) => {
        setChallenge((prev) => ({
          ...prev,
          outgoing: { challengeId, to, ttlMs },
        }));
      });

      socket.on("match:challenge:cancelled", ({ challengeId, message }) => {
        setChallenge((prev) => ({
          incoming:
            prev.incoming?.challengeId === challengeId ? null : prev.incoming,
          outgoing:
            prev.outgoing?.challengeId === challengeId ? null : prev.outgoing,
        }));
        if (message && store.getState().status === "idle") {
          store.getState().setError(message);
        }
      });

      socket.on("match:end", (p) => {
        store.getState().applyMatchEnd(p);
      });

      let lastErrorAt = 0;
      socket.on("match:error", (p) => {
        lastErrorAt = Date.now();
        if (
          p.code === "invalid_invite" ||
          p.code === "expired" ||
          p.code === "self_invite" ||
          p.code === "inviter_unavailable"
        ) {
          setInvite(emptyInvite());
        }
        if (p.code === "challenge_unavailable") {
          setChallenge({ incoming: null, outgoing: null });
        }
        store.getState().setError(p.message);
      });

      socket.on("disconnect", (reason) => {
        if (cancelled) return;
        if (reason === "io client disconnect") return;
        if (
          (socket as GameSocket & { active?: boolean }).active &&
          reason !== "io server disconnect"
        ) {
          return;
        }
        // If a match:error arrived in the last beat, keep its specific message
        // instead of clobbering it with the generic disconnect text.
        if (Date.now() - lastErrorAt < 1000) return;
        store.getState().setError(
          reason === "io server disconnect"
            ? "Server closed the connection."
            : "Connection lost.",
        );
      });

      socket.emit("match:social:sync");
    })();

    return () => {
      cancelled = true;
      cleanupBridge();
      const s = socketRef.current;
      socketRef.current = null;
      if (s) {
        s.removeAllListeners();
      }
      disposeSocket();
      // Reset to idle so a remount starts clean.
      useMatchStore.getState().reset();
    };
  }, []);

  const withSocket = useCallback((fn: (socket: GameSocket) => void) => {
    const store = useMatchStore.getState();
    void (async () => {
      try {
        const socket = socketRef.current?.connected
          ? socketRef.current
          : await getSocket();
        socketRef.current = socket;
        fn(socket);
      } catch (err) {
        store.setError(
          err instanceof Error ? err.message : "Failed to connect to multiplayer.",
        );
      }
    })();
  }, []);

  const findMatch = useCallback(() => {
    const store = useMatchStore.getState();
    store.setSearching();
    withSocket((socket) => socket.emit("queue:join"));
  }, [withSocket]);

  const retryConnection = useCallback(() => {
    const store = useMatchStore.getState();
    store.clearError();
    void (async () => {
      try {
        const socket = await reconnectSocket();
        socketRef.current = socket;
      } catch (err) {
        store.setError(
          err instanceof Error ? err.message : "Server still unreachable",
        );
      }
    })();
  }, []);

  const cancelSearch = useCallback(() => {
    const s = socketRef.current;
    if (s) {
      s.emit("queue:leave");
      if (invite.token || invite.role === "host") s.emit("match:invite:cancel");
    }
    setInvite(emptyInvite());
    useMatchStore.getState().setIdle();
  }, [invite.role, invite.token]);

  const leaveMatch = useCallback(() => {
    const s = socketRef.current;
    if (s) s.emit("match:leave");
    setInvite(emptyInvite());
    useMatchStore.getState().reset();
  }, []);

  const createInviteCb = useCallback(() => {
    withSocket((socket) => socket.emit("match:invite:create"));
  }, [withSocket]);

  const cancelInviteCb = useCallback(() => {
    const s = socketRef.current;
    if (s) s.emit("match:invite:cancel");
    setInvite(emptyInvite());
    useMatchStore.getState().setIdle();
  }, []);

  const joinInviteCb = useCallback((token: string) => {
    setInvite({
      token,
      url: inviteUrl(token),
      ttlMs: null,
      targetUserId: null,
      role: "joiner",
    });
    useMatchStore.getState().setSearching();
    withSocket((socket) => socket.emit("match:invite:join", { token }));
  }, [withSocket]);

  const challengeFriendCb = useCallback((userId: string) => {
    if (!userId) return;
    withSocket((socket) => socket.emit("match:challenge:friend", { userId }));
  }, [withSocket]);

  const respondChallengeCb = useCallback((challengeId: string, accept: boolean) => {
    if (!challengeId) return;
    if (accept) useMatchStore.getState().setSearching();
    setChallenge((prev) => ({
      incoming:
        prev.incoming?.challengeId === challengeId ? null : prev.incoming,
      outgoing: prev.outgoing,
    }));
    withSocket((socket) =>
      socket.emit("match:challenge:respond", { challengeId, accept }),
    );
  }, [withSocket]);

  const cancelChallengeCb = useCallback((challengeId: string) => {
    if (!challengeId) return;
    setChallenge((prev) => ({
      incoming: prev.incoming,
      outgoing:
        prev.outgoing?.challengeId === challengeId ? null : prev.outgoing,
    }));
    withSocket((socket) => socket.emit("match:challenge:cancel", { challengeId }));
  }, [withSocket]);

  return {
    status,
    snapshot,
    currentRound,
    lastRoundEnd,
    opponentLive,
    spectating,
    ownDeadSnapshot,
    errorMessage,
    connectionState,
    invite,
    challenge,
    findMatch,
    retryConnection,
    leaveMatch,
    cancelSearch,
    createInvite: createInviteCb,
    cancelInvite: cancelInviteCb,
    joinInvite: joinInviteCb,
    challengeFriend: challengeFriendCb,
    respondChallenge: respondChallengeCb,
    cancelChallenge: cancelChallengeCb,
  };
}

// Phaser → server pipe. `round:end` becomes match:roundResult, `stats:update`
// becomes match:scoreTick (throttled), `cells:events` becomes match:cellEvents
// (forwarded immediately so spectator feels live), and `board:snapshot` is
// stashed in the store for the side mini-board.
function wireBridgeListeners(refs: {
  socketRef: React.MutableRefObject<GameSocket | null>;
  roundIndexRef: React.MutableRefObject<number>;
  lastTickAtRef: React.MutableRefObject<number>;
}): () => void {
  const onStats = (stats: GameStats) => {
    const s = refs.socketRef.current;
    if (!s) return;
    const now = Date.now();
    if (now - refs.lastTickAtRef.current < SCORE_TICK_INTERVAL_MS) return;
    refs.lastTickAtRef.current = now;
    const snap: ScoreSnapshot = {
      total: stats.score.total,
      liveMultiplier: stats.liveMultiplier,
      liveSpeedMultiplier: stats.liveSpeedMultiplier,
      liveAccuracyMultiplier: stats.liveAccuracyMultiplier,
      liveStreak: stats.liveStreak,
      accuracyStreak: stats.accuracyStreak,
      lives: stats.lives,
      maxLives: stats.maxLives,
      stunRemainingMs: stats.stunRemainingMs,
      status: "playing",
      cellsRevealed: stats.cellsRevealed,
    };
    s.emit("match:scoreTick", {
      roundIndex: refs.roundIndexRef.current,
      snap,
    });
  };

  const onRoundEnd = (result: RoundResult) => {
    const s = refs.socketRef.current;
    if (!s) return;
    if (result.config.mode !== "match") return;
    const roundIndex = result.config.roundIndex ?? refs.roundIndexRef.current;
    s.emit("match:roundResult", { roundIndex, result });
  };

  const onCellEvents = (events: CellEvent[]) => {
    const s = refs.socketRef.current;
    if (!s || !events.length) return;
    s.emit("match:cellEvents", {
      roundIndex: refs.roundIndexRef.current,
      events,
    });
  };

  const onSnapshot = (snap: BoardSnapshot) => {
    useMatchStore.getState().setOwnDeadSnapshot(snap);
  };

  bridge.on("stats:update", onStats);
  bridge.on("round:end", onRoundEnd);
  bridge.on("cells:events", onCellEvents);
  bridge.on("board:snapshot", onSnapshot);

  return () => {
    bridge.off("stats:update", onStats);
    bridge.off("round:end", onRoundEnd);
    bridge.off("cells:events", onCellEvents);
    bridge.off("board:snapshot", onSnapshot);
  };
}
