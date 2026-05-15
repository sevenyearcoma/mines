// Friend ops: tiny wrappers around the supabase queries that enforce the
// "lex-ordered single row" invariant of the friendships table.

import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Friendship } from "@/lib/types/db";

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Resolve a username (case-insensitive) to a profile id, or null. */
export async function findUserIdByUsername(
  username: string,
): Promise<{ id: string; username: string; country: string | null } | null> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, country")
    .ilike("username", username.trim())
    .maybeSingle();
  return (data as { id: string; username: string; country: string | null } | null) ?? null;
}

/** Send a pending friend request from `me` to `target`. */
export async function sendRequest(
  meId: string,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (meId === targetId) return { ok: false, error: "Can't friend yourself." };
  const [user_a, user_b] = orderPair(meId, targetId);
  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("friendships").insert({
    user_a,
    user_b,
    status: "pending",
    requested_by: meId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Accept a pending request. Only the non-requester can do this — the RLS
 *  policy enforces the actor is a party; the WHERE here enforces non-self.*/
export async function acceptRequest(
  meId: string,
  otherId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user_a, user_b] = orderPair(meId, otherId);
  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .eq("status", "pending")
    .neq("requested_by", meId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cancel / decline / unfriend — same op, just deletes the row. */
export async function removeFriendship(
  meId: string,
  otherId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user_a, user_b] = orderPair(meId, otherId);
  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("user_a", user_a)
    .eq("user_b", user_b);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface FriendListEntry {
  // The OTHER person's profile (not me).
  user_id: string;
  username: string;
  country: string | null;
  status: Friendship["status"];
  // True if *I* sent the pending request (i.e. waiting on them).
  iAmRequester: boolean;
  created_at: string;
}

/** Fetch all friendships (pending + accepted) for a user, joined with the
 *  other party's profile bits. Returns oriented entries (the "other person"
 *  is always populated). */
export async function fetchFriends(meId: string): Promise<FriendListEntry[]> {
  const supabase = getBrowserSupabase();
  // RLS already scopes to rows where I'm a party, so no filter needed.
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "user_a, user_b, status, requested_by, created_at, a:profiles!friendships_user_a_fkey(username, country), b:profiles!friendships_user_b_fkey(username, country)",
    )
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  type Row = {
    user_a: string;
    user_b: string;
    status: Friendship["status"];
    requested_by: string;
    created_at: string;
    a: { username: string; country: string | null } | null;
    b: { username: string; country: string | null } | null;
  };
  return ((data as unknown) as Row[]).map((row) => {
    const otherIsB = row.user_a === meId;
    const otherId = otherIsB ? row.user_b : row.user_a;
    const otherProfile = otherIsB ? row.b : row.a;
    return {
      user_id: otherId,
      username: otherProfile?.username ?? "player",
      country: otherProfile?.country ?? null,
      status: row.status,
      iAmRequester: row.requested_by === meId,
      created_at: row.created_at,
    };
  });
}
