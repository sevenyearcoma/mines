import type { ActionLogEntry, Difficulty, RoundEndReason } from "@/lib/engine";

export type SingleDemoKind = "solo" | "daily";
export type DemoKind = SingleDemoKind | "match";

export interface Demo {
  id: string;
  kind: DemoKind;
  user_id: string;
  username: string;
  country: string | null;
  rows: number;
  cols: number;
  mines: number;
  seed: number;
  difficulty: Difficulty;
  // For daily, the auto-planted starting cell. For solo, null — the engine
  // plants on the first reveal action.
  prePlant: { r: number; c: number } | null;
  won: boolean;
  elapsed_ms: number;
  opens: number;
  clicks: number;
  flagged: number;
  played_at: string;
  date: string | null;          // only set for daily
  actions: ActionLogEntry[];
  reason?: RoundEndReason;
  score_total?: number;
  mistakes?: number;
}

export interface MatchDemo {
  kind: "match";
  id: string;
  matchId: string;
  roundIndex: number;
  rows: number;
  cols: number;
  mines: number;
  seed: number;
  timeLimitMs: number | null;
  prePlant: { r: number; c: number } | null;
  winner: 0 | 1 | null;
  played_at: string;
  player0: Demo;
  player1: Demo;
}

export function matchDemoId(matchId: string, roundIndex: number): string {
  return `${matchId}-${roundIndex}`;
}
