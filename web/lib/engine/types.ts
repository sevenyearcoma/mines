export type Difficulty = "beginner" | "intermediate" | "expert";

export interface DiffSpec {
  rows: number;
  cols: number;
  mines: number;
}

export interface Cell {
  r: number;
  c: number;
  mine: boolean;
  adj: number;
  revealed: boolean;
  flagged: boolean;
}

export type Board = Cell[][];

export interface RevealResult {
  revealed: { r: number; c: number; dist: number }[];
  hitMine: boolean;
  anyRevealed: boolean;
}

export interface ChordResult {
  revealed: { r: number; c: number; dist: number }[];
  hitMine: boolean;
}

// ---------------------------------------------------------------------------
// PvP / round-based play
// ---------------------------------------------------------------------------

export type RoundMode = "casual" | "match";

export interface RoundConfig {
  seed: number;
  rows: number;
  cols: number;
  mines: number;
  // null = no cap (casual). Match rounds set this to enforce a deadline.
  timeLimitMs: number | null;
  mode: RoundMode;
  // Optional metadata so the scene can echo it back in RoundResult.
  difficulty?: Difficulty;
  roundIndex?: number;
  matchId?: string;
}

export type ActionKind = "reveal" | "flag" | "unflag" | "chord";

export interface ActionLogEntry {
  kind: ActionKind;
  r: number;
  c: number;
  // ms since round start (i.e. since the first reveal). 0 before that.
  atMs: number;
}

// Score is accumulated per reveal action via a state machine (see scoring.ts).
// Flag actions deliberately do NOT contribute — flags are personal markers,
// and tying score to flag correctness would leak mine positions through the
// live-score feedback channel.
export interface ScoreBreakdown {
  base: number;          // raw cells * BASE_PER_OPEN, no multiplier
  combo: number;         // points earned from speed + accuracy multipliers
  speed: number;         // end-of-round bonus, only awarded on clean wins
  peakStreak: number;    // longest in-round speed streak
  peakAccuracyStreak: number;
  peakMultiplier: number;
  peakSpeedMultiplier: number;
  peakAccuracyMultiplier: number;
  mistakes: number;
  total: number;
}

export type RoundEndReason = "won" | "exploded" | "timeout";

export interface RoundResult {
  config: RoundConfig;
  reason: RoundEndReason;
  elapsedMs: number;
  opens: number;
  clicks: number;
  chains: number;
  flagged: number;
  correctFlags: number;
  misflags: number;
  postLossHintCount: number;
  boomCell?: { r: number; c: number };
  score: ScoreBreakdown;
  actions: ActionLogEntry[];
}
