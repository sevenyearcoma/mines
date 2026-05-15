import type { Difficulty, DiffSpec, RoundConfig, RoundMode } from "./types";

export const DIFFS: Record<Difficulty, DiffSpec> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

// PvP beta round: 16x16, 40 mines, 2 minute cap. Matches CLAUDE.md.
export const MATCH_ROUND_TIME_MS = 120_000;

export function newSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function roundConfigFromDifficulty(
  difficulty: Difficulty,
  seed?: number,
  mode: RoundMode = "casual",
): RoundConfig {
  const d = DIFFS[difficulty];
  return {
    seed: seed ?? newSeed(),
    rows: d.rows,
    cols: d.cols,
    mines: d.mines,
    timeLimitMs: mode === "match" ? MATCH_ROUND_TIME_MS : null,
    mode,
    difficulty,
  };
}

// ---------------------------------------------------------------------------
// Daily challenge
// ---------------------------------------------------------------------------

// UTC YYYY-MM-DD so every player on earth gets the same challenge on the same
// calendar day. The boundary is at 00:00 UTC.
export function todayUtcDate(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// FNV-1a 32-bit hash of the UTC date string. Deterministic and produces a
// reasonable spread of seeds across days; output fits the Mulberry32 PRNG.
export function dailySeedFromDate(dateUtc: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateUtc.length; i++) {
    h ^= dateUtc.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// One-life, no-clock, intermediate board (16x16/40) — "default minesweeper"
// per CLAUDE.md. The seed is locked to today's UTC date AND mines are
// pre-planted with a fixed safe-zone anchor at the center, so every player
// sees the exact same opening position and first move.
export function dailyRoundConfig(dateUtc: string = todayUtcDate()): RoundConfig {
  const d = DIFFS.intermediate;
  return {
    seed: dailySeedFromDate(dateUtc),
    rows: d.rows,
    cols: d.cols,
    mines: d.mines,
    timeLimitMs: null,
    mode: "daily",
    maxLives: 1,
    prePlant: { r: Math.floor(d.rows / 2), c: Math.floor(d.cols / 2) },
    difficulty: "intermediate",
  };
}

export * from "./types";
export * from "./rng";
export * from "./board";
export * from "./scoring";
