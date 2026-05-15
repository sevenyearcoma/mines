import "dotenv/config";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { authenticate, AuthError } from "./auth.js";
import {
  cancelInviteByUser,
  consumeInvite,
  createInvite,
  getInviteByInviter,
  readInvite,
} from "./invites.js";
import {
  enqueueOrPair,
  leaveQueue,
  replaceQueuedPlayer,
} from "./matchmaking.js";
import {
  configureSend,
  createMatch,
  handleCellEvents,
  handleForfeit,
  handleRoundResult,
  handleScoreTick,
  syncMatchState,
} from "./matchSession.js";
import {
  getMatch,
  getPlayer,
  removePlayer,
  setPlayer,
} from "./registry.js";
import type { GameSocket } from "./types.js";

const CHALLENGE_TTL_MS = 30 * 1000;
const DISCONNECT_GRACE_MS = 15 * 1000;

interface PendingChallenge {
  id: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  fromUserId: string;
  toUserId: string;
  expiresAt: number;
  expireTimer: NodeJS.Timeout;
}

const challenges = new Map<string, PendingChallenge>();
const challengeByUser = new Map<string, Set<string>>();

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const CORS_ORIGINS = corsOrigins(process.env.CORS_ORIGIN);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGINS, methods: ["GET", "POST"] },
});

// Sockets indexed by socket id so matchSession.send() can resolve them.
const sockets = new Map<string, GameSocket>();
configureSend((socketId, event, payload) => {
  const s = sockets.get(socketId);
  if (!s) return;
  // The protocol's typed events guarantee shape at every call site that
  // touches matchSession — we only widen here for emit indirection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s.emit as any)(event, payload);
});

function trackChallengeForUser(userId: string, challengeId: string): void {
  const set = challengeByUser.get(userId) ?? new Set<string>();
  set.add(challengeId);
  challengeByUser.set(userId, set);
}

function untrackChallengeForUser(userId: string, challengeId: string): void {
  const set = challengeByUser.get(userId);
  if (!set) return;
  set.delete(challengeId);
  if (set.size === 0) challengeByUser.delete(userId);
}

function clearChallenge(
  challenge: PendingChallenge,
  notify:
    | null
    | {
        reason: "cancelled" | "declined" | "expired" | "unavailable";
        message?: string;
      },
): void {
  clearTimeout(challenge.expireTimer);
  challenges.delete(challenge.id);
  untrackChallengeForUser(challenge.fromUserId, challenge.id);
  untrackChallengeForUser(challenge.toUserId, challenge.id);
  if (!notify) return;

  for (const userId of [challenge.fromUserId, challenge.toUserId]) {
    const p = getPlayer(userId);
    if (!p) continue;
    p.socket.emit("match:challenge:cancelled", {
      challengeId: challenge.id,
      ...notify,
    });
  }
}

function clearChallengesByUser(
  userId: string,
  reason: "cancelled" | "declined" | "expired" | "unavailable",
  message?: string,
): void {
  const ids = [...(challengeByUser.get(userId) ?? [])];
  for (const id of ids) {
    const challenge = challenges.get(id);
    if (challenge) clearChallenge(challenge, { reason, message });
  }
}

function ttlRemaining(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

function emitSocialState(player: { socket: GameSocket; handle: { id: string } }): void {
  const invite = getInviteByInviter(player.handle.id);
  if (invite) player.socket.emit("match:invite:ready", invite);

  const ids = [...(challengeByUser.get(player.handle.id) ?? [])];
  for (const id of ids) {
    const challenge = challenges.get(id);
    if (!challenge) continue;
    const ttlMs = ttlRemaining(challenge.expiresAt);
    if (ttlMs <= 0) continue;
    if (challenge.fromUserId === player.handle.id) {
      player.socket.emit("match:challenge:pending", {
        challengeId: challenge.id,
        to: challenge.to,
        ttlMs,
      });
    } else if (challenge.toUserId === player.handle.id) {
      player.socket.emit("match:challenge:incoming", {
        challengeId: challenge.id,
        from: challenge.from,
        ttlMs,
      });
    }
  }
}

function corsOrigins(value: string | undefined): string[] {
  const origins = new Set(
    (value ?? "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  for (const origin of [...origins]) {
    if (origin.includes("localhost")) {
      origins.add(origin.replace("localhost", "127.0.0.1"));
    }
    if (origin.includes("127.0.0.1")) {
      origins.add(origin.replace("127.0.0.1", "localhost"));
    }
  }
  return [...origins];
}

io.on("connection", async (rawSocket) => {
  const socket = rawSocket as unknown as GameSocket;
  const handshakeAuth =
    (socket.handshake.auth as Record<string, unknown> | undefined) ?? undefined;

  let handle;
  try {
    handle = await authenticate(handshakeAuth);
  } catch (err) {
    const code = err instanceof AuthError ? err.code : "auth_failed";
    const message = err instanceof Error ? err.message : "Auth failed";
    console.warn(`[auth-reject] ${socket.id} code=${code} reason="${message}"`);
    socket.emit("match:error", { code, message });
    socket.disconnect(true);
    return;
  }

  // Replace any prior connection for this user. They can only play from one
  // tab at a time; the newer connection wins.
  const prior = getPlayer(handle.id);
  const priorMatchId =
    prior?.matchId && getMatch(prior.matchId) ? prior.matchId : null;
  const priorInQueue = prior?.inQueue ?? false;
  if (prior?.disconnectTimer) {
    clearTimeout(prior.disconnectTimer);
    prior.disconnectTimer = null;
  }

  const player = {
    socket,
    handle,
    inQueue: priorInQueue,
    matchId: priorMatchId,
    disconnectTimer: null as NodeJS.Timeout | null,
  };
  setPlayer(player);
  sockets.set(socket.id, socket);
  if (priorInQueue) replaceQueuedPlayer(handle.id, player);

  if (prior && prior.socket.id !== socket.id) {
    sockets.delete(prior.socket.id);
    prior.socket.emit("match:error", {
      code: "replaced",
      message: "Another tab took over your session",
    });
    prior.socket.disconnect(true);
  }

  console.log(`[connect] ${handle.name} (${handle.id}) → ${socket.id}`);

  socket.on("queue:join", () => {
    // If they're already in a match, ignore — they need to leave first.
    if (player.matchId) {
      socket.emit("match:error", {
        code: "already_in_match",
        message: "Finish or leave your current match before queueing.",
      });
      return;
    }
    const pair = enqueueOrPair(player);
    if (!pair) {
      socket.emit("queue:status", { queued: true });
      return;
    }
    // Two players ready — light it up. Both leave the queue implicitly.
    pair[0].inQueue = false;
    pair[1].inQueue = false;
    createMatch(pair[0], pair[1]);
  });

  socket.on("queue:leave", () => {
    leaveQueue(handle.id);
    socket.emit("queue:status", { queued: false });
  });

  socket.on("match:social:sync", () => {
    emitSocialState(player);
    if (player.inQueue) socket.emit("queue:status", { queued: true });
    syncMatchState(player);
  });

  socket.on("match:scoreTick", ({ roundIndex, snap }) => {
    if (!player.matchId) return;
    const match = getMatch(player.matchId);
    if (!match) return;
    handleScoreTick(match, handle.id, roundIndex, snap);
  });

  socket.on("match:roundResult", ({ roundIndex, result }) => {
    if (!player.matchId) return;
    const match = getMatch(player.matchId);
    if (!match) return;
    handleRoundResult(match, handle.id, roundIndex, result);
  });

  socket.on("match:cellEvents", ({ roundIndex, events }) => {
    if (!player.matchId) return;
    const match = getMatch(player.matchId);
    if (!match) return;
    handleCellEvents(match, handle.id, roundIndex, events);
  });

  socket.on("match:leave", () => {
    if (!player.matchId) return;
    const match = getMatch(player.matchId);
    if (match) handleForfeit(match, handle.id);
    player.matchId = null;
  });

  // --- Friend invites ---------------------------------------------------

  socket.on("match:invite:create", () => {
    if (player.matchId) {
      socket.emit("match:error", {
        code: "already_in_match",
        message: "Finish or leave your current match first.",
      });
      return;
    }
    socket.emit("match:invite:ready", createInvite(player));
  });

  socket.on("match:invite:cancel", () => {
    cancelInviteByUser(handle.id);
  });

  socket.on("match:invite:join", ({ token }) => {
    if (player.matchId) {
      socket.emit("match:error", {
        code: "already_in_match",
        message: "Finish or leave your current match first.",
      });
      return;
    }
    if (typeof token !== "string" || !token) {
      socket.emit("match:error", {
        code: "invalid_invite",
        message: "Missing invite token.",
      });
      return;
    }
    const result = readInvite(token, handle.id);
    if (!result.ok) {
      socket.emit("match:error", { code: result.code, message: result.message });
      return;
    }
    const inviter = getPlayer(result.inviterUserId);
    if (!inviter || inviter.matchId) {
      socket.emit("match:error", {
        code: "inviter_unavailable",
        message: "Your friend is not at the table right now.",
      });
      return;
    }
    consumeInvite(token, handle.id);
    // Drop both players from any matchmaking queue, then pair directly.
    leaveQueue(inviter.handle.id);
    leaveQueue(handle.id);
    inviter.inQueue = false;
    player.inQueue = false;
    createMatch(inviter, player);
  });

  socket.on("match:challenge:friend", ({ userId }) => {
    if (player.matchId) {
      socket.emit("match:error", {
        code: "already_in_match",
        message: "Finish or leave your current match first.",
      });
      return;
    }
    if (typeof userId !== "string" || !userId) {
      socket.emit("match:error", {
        code: "invalid_challenge",
        message: "Missing friend id.",
      });
      return;
    }
    if (userId === handle.id) {
      socket.emit("match:error", {
        code: "self_challenge",
        message: "You can't challenge yourself.",
      });
      return;
    }

    const friend = getPlayer(userId);
    if (friend && !friend.matchId) {
      clearChallengesByUser(handle.id, "cancelled");
      const id = randomUUID();
      const expiresAt = Date.now() + CHALLENGE_TTL_MS;
      const challenge: PendingChallenge = {
        id,
        from: handle,
        to: friend.handle,
        fromUserId: handle.id,
        toUserId: friend.handle.id,
        expiresAt,
        expireTimer: setTimeout(() => {
          const current = challenges.get(id);
          if (!current) return;
          clearChallenge(current, {
            reason: "expired",
            message: "Challenge expired.",
          });
        }, CHALLENGE_TTL_MS),
      };
      challenges.set(id, challenge);
      trackChallengeForUser(handle.id, id);
      trackChallengeForUser(friend.handle.id, id);
      socket.emit("match:challenge:pending", {
        challengeId: id,
        to: friend.handle,
        ttlMs: CHALLENGE_TTL_MS,
      });
      friend.socket.emit("match:challenge:incoming", {
        challengeId: id,
        from: handle,
        ttlMs: CHALLENGE_TTL_MS,
      });
      return;
    }

    // Friend is not currently at a multiplayer table. Fall back to a private
    // one-shot link, tagged with the intended target so the client can surface
    // it beside that friend row.
    socket.emit("match:invite:ready", createInvite(player, userId));
  });

  socket.on("match:challenge:respond", ({ challengeId, accept }) => {
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.toUserId !== handle.id) {
      socket.emit("match:error", {
        code: "challenge_unavailable",
        message: "That challenge is no longer available.",
      });
      return;
    }

    if (!accept) {
      clearChallenge(challenge, {
        reason: "declined",
        message: `${handle.name} declined the challenge.`,
      });
      return;
    }

    const challenger = getPlayer(challenge.fromUserId);
    const challenged = getPlayer(challenge.toUserId);
    if (!challenger || !challenged || challenger.matchId || challenged.matchId) {
      clearChallenge(challenge, {
        reason: "unavailable",
        message: "That player is no longer available.",
      });
      return;
    }

    clearChallenge(challenge, null);
    leaveQueue(challenger.handle.id);
    leaveQueue(challenged.handle.id);
    cancelInviteByUser(challenger.handle.id);
    cancelInviteByUser(challenged.handle.id);
    clearChallengesByUser(challenger.handle.id, "cancelled");
    clearChallengesByUser(challenged.handle.id, "cancelled");
    challenger.inQueue = false;
    challenged.inQueue = false;
    createMatch(challenger, challenged);
  });

  socket.on("match:challenge:cancel", ({ challengeId }) => {
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.fromUserId !== handle.id) return;
    clearChallenge(challenge, {
      reason: "cancelled",
      message: `${handle.name} cancelled the challenge.`,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[disconnect] ${handle.name} (${reason})`);
    sockets.delete(socket.id);
    // Only clear if this is still the active socket for the user — a
    // "replaced" disconnect has already had its slot taken over.
    const current = getPlayer(handle.id);
    if (current && current.socket.id === socket.id) {
      leaveQueue(handle.id);
      current.inQueue = false;
      if (player.matchId) {
        if (current.disconnectTimer) clearTimeout(current.disconnectTimer);
        current.disconnectTimer = setTimeout(() => {
          const latest = getPlayer(handle.id);
          if (!latest || latest.socket.id !== socket.id) return;
          removePlayer(handle.id);
          cancelInviteByUser(handle.id);
          clearChallengesByUser(
            handle.id,
            "unavailable",
            `${handle.name} disconnected.`,
          );
          const match = getMatch(player.matchId!);
          player.matchId = null;
          if (match) handleForfeit(match, handle.id);
        }, DISCONNECT_GRACE_MS);
        return;
      }
      removePlayer(handle.id);
      cancelInviteByUser(handle.id);
      clearChallengesByUser(
        handle.id,
        "unavailable",
        `${handle.name} disconnected.`,
      );
    }
  });

  socket.emit("match:ready");
});

httpServer.listen(PORT, () => {
  console.log(
    `[mines-server] listening on :${PORT}, allowing ${CORS_ORIGINS.join(", ")}`,
  );
});
