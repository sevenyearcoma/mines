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

export type RoundMode = "casual" | "match" | "daily";

export interface RoundConfig {
  seed: number;
  rows: number;
  cols: number;
  mines: number;
  // null = no cap (casual). Match rounds set this to enforce a deadline.
  timeLimitMs: number | null;
  mode: RoundMode;
  // HP for this round. Undefined → engine default (MAX_LIVES). Daily challenge
  // uses 1 ("one life, pure hardcore"), regular casual/match keep 2.
  maxLives?: number;
  // If set, mines are placed at round setup using this cell as the safe-zone
  // anchor, and that cell is auto-revealed before any input. Used for "same
  // board for everyone" modes (daily challenge) so the first move is forced
  // and the layout is identical for all players.
  prePlant?: { r: number; c: number };
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
  // ms since round start. Casual/daily start on first action; match starts on load.
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
  control: number;       // board-control bonus from safe clear percentage
  penalty: number;       // mistake penalty subtracted from final score
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
