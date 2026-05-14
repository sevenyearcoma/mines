import "dotenv/config";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { authenticate, AuthError } from "./auth.js";
import { enqueueOrPair, leaveQueue } from "./matchmaking.js";
import {
  configureSend,
  createMatch,
  handleCellEvents,
  handleForfeit,
  handleRoundResult,
  handleScoreTick,
} from "./matchSession.js";
import {
  getMatch,
  getPlayer,
  removePlayer,
  setPlayer,
} from "./registry.js";
import type { GameSocket } from "./types.js";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
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

io.on("connection", async (rawSocket) => {
  const socket = rawSocket as unknown as GameSocket;
  const token =
    typeof socket.handshake.auth?.token === "string"
      ? socket.handshake.auth.token
      : undefined;

  let handle;
  try {
    handle = await authenticate(token);
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
  if (prior && prior.socket.id !== socket.id) {
    prior.socket.emit("match:error", {
      code: "replaced",
      message: "Another tab took over your session",
    });
    prior.socket.disconnect(true);
  }

  const player = {
    socket,
    handle,
    inQueue: false,
    matchId: null as string | null,
  };
  setPlayer(player);
  sockets.set(socket.id, socket);

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

  socket.on("disconnect", (reason) => {
    console.log(`[disconnect] ${handle.name} (${reason})`);
    // Only clear if this is still the active socket for the user — a
    // "replaced" disconnect has already had its slot taken over.
    const current = getPlayer(handle.id);
    if (current && current.socket.id === socket.id) {
      removePlayer(handle.id);
      sockets.delete(socket.id);
      leaveQueue(handle.id);
      if (player.matchId) {
        const match = getMatch(player.matchId);
        if (match) handleForfeit(match, handle.id);
      }
    } else {
      sockets.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[mines-server] listening on :${PORT}, allowing ${CORS_ORIGIN}`);
});
