import type { Difficulty } from "@/lib/engine";

export type Profile = {
  id: string;
  username: string;
  country: string | null;             // ISO 3166-1 alpha-2 (e.g. "US")
  created_at: string;
  games_played: number;
  games_won: number;
  current_streak: number;
  best_streak: number;
  best_time_beginner_ms: number | null;
  best_time_intermediate_ms: number | null;
  best_time_expert_ms: number | null;
};

export type Game = {
  id: string;
  user_id: string;
  difficulty: Difficulty;
  seed: number;
  won: boolean;
  elapsed_ms: number;
  opens: number;
  clicks: number;
  flagged: number;
  post_loss_hint_count: number;
  boom_r: number | null;
  boom_c: number | null;
  played_at: string;
  // JSONB column; present on games saved after 0006. Older rows are null.
  actions: unknown | null;
};

export type NewGame = Omit<Game, "id" | "played_at">;

export type SoloProgress = {
  user_id: string;
  difficulty: Difficulty;
  state: unknown;
  updated_at: string;
};

export type MatchRoundDemo = {
  id: string;
  match_id: string;
  round_index: number;
  rows: number;
  cols: number;
  mines: number;
  seed: number;
  time_limit_ms: number | null;
  pre_plant_r: number | null;
  pre_plant_c: number | null;
  winner_index: 0 | 1 | null;
  player0_id: string;
  player1_id: string;
  player0_reason: "won" | "exploded" | "timeout";
  player0_elapsed_ms: number;
  player0_opens: number;
  player0_clicks: number;
  player0_flagged: number;
  player0_score: number;
  player0_mistakes: number;
  player0_actions: unknown;
  player1_reason: "won" | "exploded" | "timeout";
  player1_elapsed_ms: number;
  player1_opens: number;
  player1_clicks: number;
  player1_flagged: number;
  player1_score: number;
  player1_mistakes: number;
  player1_actions: unknown;
  played_at: string;
};

export type FriendshipStatus = "pending" | "accepted";

export type Friendship = {
  user_a: string;
  user_b: string;
  status: FriendshipStatus;
  requested_by: string;
  created_at: string;
};
