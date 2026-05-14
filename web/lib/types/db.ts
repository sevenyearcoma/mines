import type { Difficulty } from "@/lib/engine";

export type Profile = {
  id: string;
  username: string;
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
};

export type NewGame = Omit<Game, "id" | "played_at">;
