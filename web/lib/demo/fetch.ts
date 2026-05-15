import { DIFFS, type Difficulty, type RoundEndReason } from "@/lib/engine";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Demo, DemoKind, MatchDemo } from "./types";

type ProfileBit = { username: string; country: string | null };

interface GamesRow {
  id: string;
  user_id: string;
  difficulty: Difficulty;
  seed: number;
  won: boolean;
  elapsed_ms: number;
  opens: number;
  clicks: number;
  flagged: number;
  played_at: string;
  actions: unknown;
  profiles: ProfileBit | null;
}

interface DailyRow {
  id: string;
  user_id: string;
  date: string;
  seed: number;
  won: boolean;
  elapsed_ms: number;
  opens: number;
  clicks: number;
  flagged: number;
  played_at: string;
  actions: unknown;
  pre_plant_r: number | null;
  pre_plant_c: number | null;
  profiles: ProfileBit | null;
}

interface MatchDemoRow {
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
  played_at: string;
  player0_id: string;
  player1_id: string;
  player0_reason: RoundEndReason;
  player0_elapsed_ms: number;
  player0_opens: number;
  player0_clicks: number;
  player0_flagged: number;
  player0_score: number;
  player0_mistakes: number;
  player0_actions: unknown;
  player1_reason: RoundEndReason;
  player1_elapsed_ms: number;
  player1_opens: number;
  player1_clicks: number;
  player1_flagged: number;
  player1_score: number;
  player1_mistakes: number;
  player1_actions: unknown;
  player0: ProfileBit | null;
  player1: ProfileBit | null;
}

export function normalizeActions(raw: unknown): Demo["actions"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      const kind = e.kind;
      const r = e.r;
      const c = e.c;
      const atMs = e.atMs;
      if (
        (kind !== "reveal" &&
          kind !== "flag" &&
          kind !== "unflag" &&
          kind !== "chord") ||
        typeof r !== "number" ||
        typeof c !== "number" ||
        typeof atMs !== "number"
      ) {
        return null;
      }
      return { kind, r, c, atMs };
    })
    .filter((x): x is Demo["actions"][number] => x !== null);
}

export async function fetchDemo(
  kind: DemoKind,
  id: string,
): Promise<Demo | MatchDemo | null> {
  const supabase = await getServerSupabase();

  if (kind === "solo") {
    const { data, error } = await supabase
      .from("games")
      .select(
        "id, user_id, difficulty, seed, won, elapsed_ms, opens, clicks, flagged, played_at, actions, profiles!inner(username, country)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as GamesRow;
    const spec = DIFFS[row.difficulty];
    return {
      id: row.id,
      kind: "solo",
      user_id: row.user_id,
      username: row.profiles?.username ?? "player",
      country: row.profiles?.country ?? null,
      rows: spec.rows,
      cols: spec.cols,
      mines: spec.mines,
      seed: Number(row.seed),
      difficulty: row.difficulty,
      prePlant: null,
      won: row.won,
      elapsed_ms: row.elapsed_ms,
      opens: row.opens,
      clicks: row.clicks,
      flagged: row.flagged,
      played_at: row.played_at,
      date: null,
      actions: normalizeActions(row.actions),
    };
  }

  if (kind === "daily") {
    const { data, error } = await supabase
      .from("daily_completions")
      .select(
        "id, user_id, date, seed, won, elapsed_ms, opens, clicks, flagged, played_at, actions, pre_plant_r, pre_plant_c, profiles!inner(username, country)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as DailyRow;
    const spec = DIFFS.intermediate;
    const prePlant =
      row.pre_plant_r !== null && row.pre_plant_c !== null
        ? { r: row.pre_plant_r, c: row.pre_plant_c }
        : { r: Math.floor(spec.rows / 2), c: Math.floor(spec.cols / 2) };
    return {
      id: row.id,
      kind: "daily",
      user_id: row.user_id,
      username: row.profiles?.username ?? "player",
      country: row.profiles?.country ?? null,
      rows: spec.rows,
      cols: spec.cols,
      mines: spec.mines,
      seed: Number(row.seed),
      difficulty: "intermediate",
      prePlant,
      won: row.won,
      elapsed_ms: row.elapsed_ms,
      opens: row.opens,
      clicks: row.clicks,
      flagged: row.flagged,
      played_at: row.played_at,
      date: row.date,
      actions: normalizeActions(row.actions),
    };
  }

  const { data, error } = await supabase
    .from("match_round_demos")
    .select(
      [
        "id",
        "match_id",
        "round_index",
        "rows",
        "cols",
        "mines",
        "seed",
        "time_limit_ms",
        "pre_plant_r",
        "pre_plant_c",
        "winner_index",
        "played_at",
        "player0_id",
        "player1_id",
        "player0_reason",
        "player0_elapsed_ms",
        "player0_opens",
        "player0_clicks",
        "player0_flagged",
        "player0_score",
        "player0_mistakes",
        "player0_actions",
        "player1_reason",
        "player1_elapsed_ms",
        "player1_opens",
        "player1_clicks",
        "player1_flagged",
        "player1_score",
        "player1_mistakes",
        "player1_actions",
        "player0:profiles!match_round_demos_player0_id_fkey(username, country)",
        "player1:profiles!match_round_demos_player1_id_fkey(username, country)",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as MatchDemoRow;
  const prePlant =
    row.pre_plant_r !== null && row.pre_plant_c !== null
      ? { r: row.pre_plant_r, c: row.pre_plant_c }
      : null;

  const player0 = makeMatchPlayerDemo(row, 0, prePlant);
  const player1 = makeMatchPlayerDemo(row, 1, prePlant);

  return {
    kind: "match",
    id: row.id,
    matchId: row.match_id,
    roundIndex: row.round_index,
    rows: row.rows,
    cols: row.cols,
    mines: row.mines,
    seed: Number(row.seed),
    timeLimitMs: row.time_limit_ms,
    prePlant,
    winner: row.winner_index,
    played_at: row.played_at,
    player0,
    player1,
  };
}

function makeMatchPlayerDemo(
  row: MatchDemoRow,
  player: 0 | 1,
  prePlant: MatchDemo["prePlant"],
): Demo {
  const profile = player === 0 ? row.player0 : row.player1;
  const userId = player === 0 ? row.player0_id : row.player1_id;
  const stats =
    player === 0
      ? {
          reason: row.player0_reason,
          elapsed_ms: row.player0_elapsed_ms,
          opens: row.player0_opens,
          clicks: row.player0_clicks,
          flagged: row.player0_flagged,
          score: row.player0_score,
          mistakes: row.player0_mistakes,
          actions: row.player0_actions,
        }
      : {
          reason: row.player1_reason,
          elapsed_ms: row.player1_elapsed_ms,
          opens: row.player1_opens,
          clicks: row.player1_clicks,
          flagged: row.player1_flagged,
          score: row.player1_score,
          mistakes: row.player1_mistakes,
          actions: row.player1_actions,
        };
  return {
    id: `${row.id}:${player}`,
    kind: "match",
    user_id: userId,
    username: profile?.username ?? `player ${player + 1}`,
    country: profile?.country ?? null,
    rows: row.rows,
    cols: row.cols,
    mines: row.mines,
    seed: Number(row.seed),
    difficulty: "intermediate",
    prePlant,
    won: row.winner_index === player,
    elapsed_ms: stats.elapsed_ms,
    opens: stats.opens,
    clicks: stats.clicks,
    flagged: stats.flagged,
    played_at: row.played_at,
    date: null,
    actions: normalizeActions(stats.actions),
    reason: stats.reason,
    score_total: stats.score,
    mistakes: stats.mistakes,
  };
}
