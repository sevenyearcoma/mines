import { createClient } from "@supabase/supabase-js";
import type { PlayerHandle } from "../../web/lib/multiplayer/protocol.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[auth] SUPABASE_URL or SUPABASE_ANON_KEY not set — handshakes will reject all tokens.",
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function authenticate(token: string | undefined): Promise<PlayerHandle> {
  if (!token) throw new AuthError("no_token", "Missing auth token");
  if (!supabase) throw new AuthError("misconfigured", "Server missing Supabase config");

  // Validate against Supabase auth. This works regardless of the project's JWT
  // signing algorithm (HS256 legacy or RS256/ES256 asymmetric on new projects).
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError(
      "invalid_token",
      error?.message ?? "Token rejected by Supabase",
    );
  }

  const user = data.user;
  const userId = user.id;
  let name = fallbackName(user.email ?? null, userId);

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    const username = (profile as { username?: string } | null)?.username;
    if (username) name = username;
  } catch (err) {
    // Profile lookup is best-effort; fall back to whatever we derived from the user.
    console.warn("[auth] profile lookup failed", err);
  }

  return { id: userId, name };
}

function fallbackName(email: string | null, userId: string): string {
  if (email) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return `player-${userId.slice(0, 6)}`;
}
