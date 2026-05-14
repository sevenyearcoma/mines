"use client";

import { useCallback, useEffect, useRef } from "react";
import { bridge, type BoardSnapshot, type GameStats } from "@/game/bridge";
import { useMatchStore } from "@/lib/store/match";
import type { RoundResult } from "@/lib/engine";
import { disposeSocket, getSocket, type GameSocket } from "./socket";
import type { CellEvent, ScoreSnapshot } from "./protocol";

const SCORE_TICK_INTERVAL_MS = 250;

export interface UseMultiplayerMatch {
  status: ReturnType<typeof useMatchStore.getState>["status"];
  snapshot: ReturnType<typeof useMatchStore.getState>["snapshot"];
  currentRound: ReturnType<typeof useMatchStore.getState>["currentRound"];
  lastRoundEnd: ReturnType<typeof useMatchStore.getState>["lastRoundEnd"];
  opponentLive: ReturnType<typeof useMatchStore.getState>["opponentLive"];
  spectating: ReturnType<typeof useMatchStore.getState>["spectating"];
  ownDeadSnapshot: ReturnType<typeof useMatchStore.getState>["ownDeadSnapshot"];
  errorMessage: string | null;
  findMatch: () => void;
  leaveMatch: () => void;
  cancelSearch: () => void;
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

      socket.on("queue:status", ({ queued }) => {
        if (queued) store.getState().setSearching();
      });

      socket.on("match:start", (p) => {
        roundIndexRef.current = 0;
        store.getState().applyMatchStart(p);
      });

      socket.on("match:roundStart", (p) => {
        roundIndexRef.current = p.roundIndex;
        lastTickAtRef.current = 0;
        store.getState().setCurrentRound(p.config);
        // Hand off to Phaser — BoardScene already knows cmd:loadRound.
        bridge.emit("cmd:loadRound", p.config);
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

      socket.on("match:end", (p) => {
        store.getState().applyMatchEnd(p);
      });

      let lastErrorAt = 0;
      socket.on("match:error", (p) => {
        lastErrorAt = Date.now();
        store.getState().setError(p.message);
      });

      socket.on("disconnect", (reason) => {
        if (cancelled) return;
        if (reason === "io client disconnect") return;
        // If a match:error arrived in the last beat, keep its specific message
        // instead of clobbering it with the generic disconnect text.
        if (Date.now() - lastErrorAt < 1000) return;
        store.getState().setError(
          reason === "io server disconnect"
            ? "Server closed the connection."
            : "Connection lost.",
        );
      });
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

  const findMatch = useCallback(() => {
    const s = socketRef.current;
    const store = useMatchStore.getState();
    if (!s) {
      store.setError("Not connected — please refresh.");
      return;
    }
    store.setSearching();
    s.emit("queue:join");
  }, []);

  const cancelSearch = useCallback(() => {
    const s = socketRef.current;
    if (s) s.emit("queue:leave");
    useMatchStore.getState().setIdle();
  }, []);

  const leaveMatch = useCallback(() => {
    const s = socketRef.current;
    if (s) s.emit("match:leave");
    useMatchStore.getState().reset();
  }, []);

  return {
    status,
    snapshot,
    currentRound,
    lastRoundEnd,
    opponentLive,
    spectating,
    ownDeadSnapshot,
    errorMessage,
    findMatch,
    leaveMatch,
    cancelSearch,
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
      liveStreak: stats.liveStreak,
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
