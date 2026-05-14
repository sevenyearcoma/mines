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

let current: GameSocket | null = null;
let pending: Promise<GameSocket> | null = null;

async function fetchAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getSocket(): Promise<GameSocket> {
  if (current && current.connected) return current;
  if (pending) return pending;

  pending = (async () => {
    const token = await fetchAccessToken();
    if (!token) {
      pending = null;
      throw new Error("Not signed in — cannot open multiplayer socket.");
    }

    // Lazy require keeps socket.io-client out of the SSR bundle.
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,         // we'd rather error visibly than silently reconnect mid-match
    }) as unknown as GameSocket;

    current = socket;
    pending = null;
    return socket;
  })();

  return pending;
}

export function disposeSocket(): void {
  if (current) {
    current.removeAllListeners();
    current.disconnect();
    current = null;
  }
  pending = null;
}
