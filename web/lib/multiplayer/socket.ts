"use client";

import { io, type Socket } from "socket.io-client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./protocol";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
// 12s tolerates Railway free-tier cold starts; local dev rarely hits it.
const CONNECT_TIMEOUT_MS = 12000;
const GUEST_KEY = "mines.guest";

// Browser-side broadcast channel for connection lifecycle. Components anywhere
// in the tree can `window.addEventListener("mines:connection", ...)` to react
// to "connecting" | "online" | "offline" transitions without coupling to
// useMultiplayerMatch.
export type ConnectionState = "connecting" | "online" | "offline";
function emitConnectionState(state: ConnectionState, detail?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("mines:connection", { detail: { state, message: detail } }),
  );
}

type ReadyGameSocket = GameSocket & {
  __minesReady?: boolean;
  active?: boolean;
};

let current: ReadyGameSocket | null = null;
let pending: Promise<GameSocket> | null = null;

type HandshakeAuth =
  | { token: string }
  | { guest: true; guestId: string; guestName: string };

async function resolveHandshakeAuth(): Promise<HandshakeAuth | null> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) return { token };

  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; name?: string };
    if (typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
    return { guest: true, guestId: parsed.id, guestName: parsed.name };
  } catch {
    return null;
  }
}

export async function getSocket(): Promise<GameSocket> {
  if (current && current.connected && current.__minesReady) return current;
  if (pending) return pending;

  if (current && current.__minesReady) {
    pending = waitForReady(current)
      .then(() => current as GameSocket)
      .catch((err) => {
        current?.disconnect();
        current = null;
        throw err;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  pending = (async () => {
    const auth = await resolveHandshakeAuth();
    if (!auth) {
      pending = null;
      throw new Error("Not signed in — cannot open multiplayer socket.");
    }

    emitConnectionState("connecting");
    const socket = io(SOCKET_URL, {
      auth,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2500,
      timeout: CONNECT_TIMEOUT_MS,
    }) as unknown as ReadyGameSocket;

    // Surface reconnect lifecycle so the lobby card can show "connecting…" between drops.
    socket.io.on("reconnect_attempt", () => emitConnectionState("connecting"));
    socket.io.on("reconnect", () => emitConnectionState("online"));
    socket.io.on("reconnect_failed", () =>
      emitConnectionState("offline", "Server unreachable"),
    );

    current = socket;
    try {
      await waitForReady(socket);
      emitConnectionState("online");
    } catch (err) {
      socket.disconnect();
      current = null;
      emitConnectionState(
        "offline",
        err instanceof Error ? err.message : "Server unreachable",
      );
      throw err;
    }
    return socket;
  })().finally(() => {
    pending = null;
  });

  return pending;
}

function waitForReady(socket: ReadyGameSocket): Promise<void> {
  if (socket.connected && socket.__minesReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Multiplayer server is offline at ${SOCKET_URL}.`));
    }, CONNECT_TIMEOUT_MS);

    const onReady = () => {
      socket.__minesReady = true;
      cleanup();
      resolve();
    };
    const onConnectError = () => {
      if (socket.active) return;
      cleanup();
      reject(new Error(`Multiplayer server is offline at ${SOCKET_URL}.`));
    };
    const onMatchError = (p: { message: string }) => {
      cleanup();
      reject(new Error(p.message));
    };
    const onDisconnect = (reason: string) => {
      if (socket.active && reason !== "io server disconnect") return;
      cleanup();
      reject(new Error(`Multiplayer connection closed: ${reason}`));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      socket.off("match:ready", onReady);
      socket.off("match:error", onMatchError);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
    };

    socket.on("match:ready", onReady);
    socket.on("match:error", onMatchError);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.connect();
  });
}

export function disposeSocket(): void {
  if (current) {
    current.removeAllListeners();
    current.disconnect();
    current = null;
  }
  pending = null;
  emitConnectionState("offline");
}

/**
 * Force a fresh socket attempt. Used by the lobby "Retry" button when the
 * server was offline at first try. Disposes any stale socket, then opens a new
 * one; resolves to the connected socket or rejects on failure.
 */
export async function reconnectSocket(): Promise<GameSocket> {
  disposeSocket();
  return getSocket();
}
