"use client";

import type { Difficulty } from "@/lib/engine";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isSoloProgressSnapshot,
  type SoloProgressSnapshot,
} from "./progress";

type ProgressOwner = {
  userId: string | null;
  guestId: string | null;
};

type ProgressRow = {
  difficulty: Difficulty;
  state: unknown;
  updated_at: string;
};

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];
const LOCAL_PREFIX = "mines.soloProgress";

function localKey(owner: ProgressOwner, difficulty: Difficulty): string {
  return `${LOCAL_PREFIX}.${owner.guestId ?? "anon"}.${difficulty}`;
}

function withUpdatedAt(snapshot: SoloProgressSnapshot): SoloProgressSnapshot {
  return { ...snapshot, updatedAt: new Date().toISOString() };
}

function readLocal(owner: ProgressOwner, difficulty: Difficulty) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localKey(owner, difficulty));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSoloProgressSnapshot(parsed, difficulty)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(owner: ProgressOwner, snapshot: SoloProgressSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      localKey(owner, snapshot.difficulty),
      JSON.stringify(snapshot),
    );
  } catch {
    // Best effort. If local storage is unavailable, the game remains playable.
  }
}

function clearLocal(owner: ProgressOwner, difficulty: Difficulty) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(localKey(owner, difficulty));
  } catch {
    // best effort
  }
}

export async function loadSoloProgress(
  owner: ProgressOwner,
  difficulty: Difficulty,
): Promise<SoloProgressSnapshot | null> {
  if (!owner.userId) return readLocal(owner, difficulty);

  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("solo_progress")
    .select("difficulty,state,updated_at")
    .eq("user_id", owner.userId)
    .eq("difficulty", difficulty)
    .maybeSingle();

  if (error) {
    console.warn("[SoloProgress] load failed:", error);
    return null;
  }

  const row = data as ProgressRow | null;
  if (!row || !isSoloProgressSnapshot(row.state, difficulty)) return null;
  return { ...row.state, updatedAt: row.updated_at };
}

export async function loadLatestSoloProgress(
  owner: ProgressOwner,
): Promise<SoloProgressSnapshot | null> {
  if (!owner.userId) {
    return DIFFICULTIES.map((difficulty) => readLocal(owner, difficulty))
      .filter((p): p is SoloProgressSnapshot => p !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }

  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("solo_progress")
    .select("difficulty,state,updated_at")
    .eq("user_id", owner.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[SoloProgress] latest load failed:", error);
    return null;
  }

  const row = data as ProgressRow | null;
  if (!row || !isSoloProgressSnapshot(row.state, row.difficulty)) return null;
  return { ...row.state, updatedAt: row.updated_at };
}

export async function saveSoloProgress(
  owner: ProgressOwner,
  snapshot: SoloProgressSnapshot,
): Promise<void> {
  const next = withUpdatedAt(snapshot);
  if (!owner.userId) {
    writeLocal(owner, next);
    return;
  }

  const supabase = getBrowserSupabase();
  const { error } = await supabase.from("solo_progress").upsert(
    {
      user_id: owner.userId,
      difficulty: next.difficulty,
      state: next,
      updated_at: next.updatedAt,
    },
    { onConflict: "user_id,difficulty" },
  );

  if (error) {
    console.warn("[SoloProgress] save failed:", error);
  }
}

export async function clearSoloProgress(
  owner: ProgressOwner,
  difficulty: Difficulty,
): Promise<void> {
  if (!owner.userId) {
    clearLocal(owner, difficulty);
    return;
  }

  const supabase = getBrowserSupabase();
  const { error } = await supabase
    .from("solo_progress")
    .delete()
    .eq("user_id", owner.userId)
    .eq("difficulty", difficulty);

  if (error) {
    console.warn("[SoloProgress] clear failed:", error);
  }
}
