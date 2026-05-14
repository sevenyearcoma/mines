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

export * from "./types";
export * from "./rng";
export * from "./board";
export * from "./scoring";
