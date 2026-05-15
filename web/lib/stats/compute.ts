// Deep-cut stats. All pure functions over the games[] you already have on
// the client — no extra schema. Pull the action log via the existing JSONB
// column and derive everything else.

import { detectCoach } from "@/lib/coach/detect";
import {
  DIFFS,
  chord as engineChord,
  emptyBoard,
  flag as engineFlag,
  plant,
  reveal as engineReveal,
  type ActionLogEntry,
  type Difficulty,
} from "@/lib/engine";
import type { Game } from "@/lib/types/db";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];

// Time bucket boundaries for the decision-speed histogram (ms between two
// consecutive reveal/chord actions in the same game).
const DECISION_BUCKETS = {
  instant: 250,
  fast: 500,
  normal: 1000,
  slow: 2000,
  hesitant: 4000,
} as const;

export interface DifficultyStats {
  games: number;
  wins: number;
  winRate: number;             // 0..1
  avgWinTimeMs: number | null; // avg elapsed_ms of WINS (losses skew it)
  bestWinTimeMs: number | null;
  avgOpens: number | null;
  avgClicks: number | null;
}

export interface DecisionSpeedBuckets {
  instant: number;
  fast: number;
  normal: number;
  slow: number;
  hesitant: number;
  frozen: number;
}

export interface HourlyBucket {
  hour: number;   // 0..23 local
  games: number;
  wins: number;
  winRate: number;
}

export interface BoomRegions {
  corner: number;
  edge: number;
  center: number;
}

export interface GuessStats {
  // Every cell-reveal action across the analyzed games (first plant clicks
  // included; chord cascades counted once as a chord, not per cell).
  totalReveals: number;
  // Reveals that the coach could prove safe BEFORE the click — i.e. the
  // player followed a deduction rather than guessing.
  deductedReveals: number;
  // Reveals that were NOT proven safe by the coach when the player clicked.
  guesses: number;
  // Guesses that landed on a mine. With multi-life mode you can survive
  // these; without it they end the round.
  guessBusts: number;
  // (guesses - guessBusts) / guesses
  guessSuccessRate: number;
  // deductedReveals / totalReveals
  deductionRate: number;
}

export interface ComputedStats {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  // Solo games that have a recorded action log (i.e. eligible for action-level
  // metrics like decision speed, pacing). Older games lack `actions`.
  gamesWithActions: number;

  // Guess vs deduction analysis — needs detectCoach() per reveal so it
  // dominates compute time for this module. Still acceptable for ~200 games.
  guessStats: GuessStats;

  byDifficulty: Record<Difficulty, DifficultyStats>;
  mostPlayed: Difficulty | null;

  // 16×16 normalized boom heatmap. Coordinates from every difficulty are
  // mapped onto a unit square and bucketed here so we can render one chart
  // regardless of which boards the user prefers.
  boomHeatmap: number[]; // length 256, values are raw counts
  boomHeatmapMax: number;
  boomRegions: BoomRegions;
  totalBooms: number;

  decisionSpeed: DecisionSpeedBuckets;
  decisionSpeedTotal: number;
  medianDecisionMs: number | null;

  // First half vs second half average decision interval per game, then
  // averaged across games. Reveals whether the player slows down or speeds
  // up under pressure.
  firstHalfAvgMs: number | null;
  secondHalfAvgMs: number | null;
  pacingDelta: number | null;   // second - first; positive = slowing down

  // 24 hourly buckets in the player's LOCAL time. Hour 0 = midnight local.
  timeOfDay: HourlyBucket[];
  bestHour: HourlyBucket | null;

  // opens / clicks — higher = more flood reveals per click = bolder play
  avgOpensPerClick: number | null;

  // Time from first action to first boom (lost games only). A short time
  // means you rush into mistakes; a long time means you're patient but
  // eventually crack.
  avgTimeToFirstBoomMs: number | null;
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function computeAllStats(games: Game[]): ComputedStats {
  const totalGames = games.length;
  const wins = games.filter((g) => g.won).length;
  const losses = totalGames - wins;
  const gamesWithActions = games.filter(
    (g) => Array.isArray(g.actions) && (g.actions as unknown[]).length > 0,
  ).length;

  const byDifficulty = computeByDifficulty(games);
  const mostPlayed = pickMostPlayed(byDifficulty);

  const { heatmap, max, regions, total } = computeBoomHeatmap(games);
  const intervals = collectDecisionIntervals(games);
  const decisionSpeed = bucketIntervals(intervals);
  const medianDecisionMs = median(intervals);
  const { first, second, delta } = computePacing(games);
  const timeOfDay = computeTimeOfDay(games);
  const bestHour = pickBestHour(timeOfDay);
  const avgOpensPerClick = averageRatio(games, (g) =>
    g.clicks > 0 ? g.opens / g.clicks : null,
  );
  const avgTimeToFirstBoomMs = computeAvgTimeToFirstBoom(games);
  const guessStats = computeGuessStats(games);

  return {
    totalGames,
    totalWins: wins,
    totalLosses: losses,
    winRate: totalGames > 0 ? wins / totalGames : 0,
    gamesWithActions,
    guessStats,
    byDifficulty,
    mostPlayed,
    boomHeatmap: heatmap,
    boomHeatmapMax: max,
    boomRegions: regions,
    totalBooms: total,
    decisionSpeed,
    decisionSpeedTotal: intervals.length,
    medianDecisionMs,
    firstHalfAvgMs: first,
    secondHalfAvgMs: second,
    pacingDelta: delta,
    timeOfDay,
    bestHour,
    avgOpensPerClick,
    avgTimeToFirstBoomMs,
  };
}

// ---------------------------------------------------------------------------
// Per-difficulty
// ---------------------------------------------------------------------------

function computeByDifficulty(
  games: Game[],
): Record<Difficulty, DifficultyStats> {
  const out = {} as Record<Difficulty, DifficultyStats>;
  for (const d of DIFFICULTIES) {
    const subset = games.filter((g) => g.difficulty === d);
    const winSubset = subset.filter((g) => g.won);
    out[d] = {
      games: subset.length,
      wins: winSubset.length,
      winRate: subset.length > 0 ? winSubset.length / subset.length : 0,
      avgWinTimeMs:
        winSubset.length > 0
          ? winSubset.reduce((a, g) => a + g.elapsed_ms, 0) / winSubset.length
          : null,
      bestWinTimeMs:
        winSubset.length > 0
          ? Math.min(...winSubset.map((g) => g.elapsed_ms))
          : null,
      avgOpens:
        subset.length > 0
          ? subset.reduce((a, g) => a + g.opens, 0) / subset.length
          : null,
      avgClicks:
        subset.length > 0
          ? subset.reduce((a, g) => a + g.clicks, 0) / subset.length
          : null,
    };
  }
  return out;
}

function pickMostPlayed(
  by: Record<Difficulty, DifficultyStats>,
): Difficulty | null {
  let best: Difficulty | null = null;
  let bestCount = 0;
  for (const d of DIFFICULTIES) {
    if (by[d].games > bestCount) {
      bestCount = by[d].games;
      best = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Boom heatmap (16×16 normalized)
// ---------------------------------------------------------------------------

const HEATMAP_SIZE = 16;

function computeBoomHeatmap(games: Game[]): {
  heatmap: number[];
  max: number;
  regions: BoomRegions;
  total: number;
} {
  const heatmap = new Array<number>(HEATMAP_SIZE * HEATMAP_SIZE).fill(0);
  const regions: BoomRegions = { corner: 0, edge: 0, center: 0 };
  let total = 0;

  for (const g of games) {
    if (g.boom_r === null || g.boom_c === null) continue;
    const spec = DIFFS[g.difficulty];
    // Normalize boom position to a 16×16 grid so all difficulties pile up
    // on the same canvas.
    const nr = Math.floor((g.boom_r / Math.max(1, spec.rows - 1)) * (HEATMAP_SIZE - 1));
    const nc = Math.floor((g.boom_c / Math.max(1, spec.cols - 1)) * (HEATMAP_SIZE - 1));
    heatmap[nr * HEATMAP_SIZE + nc] += 1;
    total += 1;

    // Region classification on the ORIGINAL grid so the meaning is honest.
    regions[classifyRegion(g.boom_r, g.boom_c, spec.rows, spec.cols)] += 1;
  }

  const max = heatmap.reduce((a, v) => (v > a ? v : a), 0);
  return { heatmap, max, regions, total };
}

function classifyRegion(
  r: number,
  c: number,
  rows: number,
  cols: number,
): keyof BoomRegions {
  const onTopBottom = r === 0 || r === rows - 1;
  const onLeftRight = c === 0 || c === cols - 1;
  if (onTopBottom && onLeftRight) return "corner";
  if (onTopBottom || onLeftRight) return "edge";
  // Inner-but-near-edge counts as edge too — a 2-cell ring feels "edgy".
  if (r <= 1 || r >= rows - 2 || c <= 1 || c >= cols - 2) return "edge";
  return "center";
}

// ---------------------------------------------------------------------------
// Decision speed
// ---------------------------------------------------------------------------

function collectDecisionIntervals(games: Game[]): number[] {
  const all: number[] = [];
  for (const g of games) {
    const acts = g.actions;
    if (!Array.isArray(acts) || acts.length < 2) continue;
    // Only consider reveal/chord actions — flagging is a separate cognitive
    // mode and inflates "fast" buckets unrealistically when you spam flags.
    const decisive = (acts as ActionLogEntry[]).filter(
      (a) => a.kind === "reveal" || a.kind === "chord",
    );
    for (let i = 1; i < decisive.length; i++) {
      const dt = decisive[i].atMs - decisive[i - 1].atMs;
      if (dt >= 0 && dt < 60_000) all.push(dt);
    }
  }
  return all;
}

function bucketIntervals(intervals: number[]): DecisionSpeedBuckets {
  const out: DecisionSpeedBuckets = {
    instant: 0,
    fast: 0,
    normal: 0,
    slow: 0,
    hesitant: 0,
    frozen: 0,
  };
  for (const dt of intervals) {
    if (dt < DECISION_BUCKETS.instant) out.instant += 1;
    else if (dt < DECISION_BUCKETS.fast) out.fast += 1;
    else if (dt < DECISION_BUCKETS.normal) out.normal += 1;
    else if (dt < DECISION_BUCKETS.slow) out.slow += 1;
    else if (dt < DECISION_BUCKETS.hesitant) out.hesitant += 1;
    else out.frozen += 1;
  }
  return out;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Pacing (first half vs second half action intervals)
// ---------------------------------------------------------------------------

function computePacing(games: Game[]): {
  first: number | null;
  second: number | null;
  delta: number | null;
} {
  let firstSum = 0;
  let firstN = 0;
  let secondSum = 0;
  let secondN = 0;
  for (const g of games) {
    const acts = g.actions;
    if (!Array.isArray(acts) || acts.length < 4) continue;
    const decisive = (acts as ActionLogEntry[]).filter(
      (a) => a.kind === "reveal" || a.kind === "chord",
    );
    if (decisive.length < 4) continue;
    const mid = Math.floor(decisive.length / 2);
    for (let i = 1; i < mid; i++) {
      const dt = decisive[i].atMs - decisive[i - 1].atMs;
      if (dt >= 0 && dt < 60_000) {
        firstSum += dt;
        firstN += 1;
      }
    }
    for (let i = mid + 1; i < decisive.length; i++) {
      const dt = decisive[i].atMs - decisive[i - 1].atMs;
      if (dt >= 0 && dt < 60_000) {
        secondSum += dt;
        secondN += 1;
      }
    }
  }
  const first = firstN > 0 ? firstSum / firstN : null;
  const second = secondN > 0 ? secondSum / secondN : null;
  const delta = first !== null && second !== null ? second - first : null;
  return { first, second, delta };
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

function computeTimeOfDay(games: Game[]): HourlyBucket[] {
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    games: 0,
    wins: 0,
    winRate: 0,
  }));
  for (const g of games) {
    const hour = new Date(g.played_at).getHours();
    if (hour < 0 || hour > 23) continue;
    buckets[hour].games += 1;
    if (g.won) buckets[hour].wins += 1;
  }
  for (const b of buckets) {
    b.winRate = b.games > 0 ? b.wins / b.games : 0;
  }
  return buckets;
}

function pickBestHour(buckets: HourlyBucket[]): HourlyBucket | null {
  // Need at least 3 games in an hour for the win rate to mean something.
  const eligible = buckets.filter((b) => b.games >= 3);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, b) =>
    b.winRate > best.winRate ? b : best,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function averageRatio(
  games: Game[],
  pick: (g: Game) => number | null,
): number | null {
  let sum = 0;
  let n = 0;
  for (const g of games) {
    const v = pick(g);
    if (v === null || !Number.isFinite(v)) continue;
    sum += v;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

// ---------------------------------------------------------------------------
// Guesses vs deductions
// ---------------------------------------------------------------------------
//
// For each solo game with a recorded action log: simulate the board state
// step-by-step, and BEFORE applying each reveal call the coach detector. If
// the cell was in the coach's safe-set, it was a deduction; otherwise it was
// a guess. Track how often guesses land on mines.
//
// First reveals are exempt — solo games plant on the first click and the
// engine carves out a safe 3×3, so the first click can't be wrong. Daily
// games aren't represented in `games`; their pre-plant is handled elsewhere.

function computeGuessStats(games: Game[]): GuessStats {
  let totalReveals = 0;
  let deductedReveals = 0;
  let guesses = 0;
  let guessBusts = 0;

  for (const game of games) {
    if (
      !Array.isArray(game.actions) ||
      (game.actions as unknown[]).length === 0
    )
      continue;
    const acts = game.actions as ActionLogEntry[];
    const spec = DIFFS[game.difficulty];
    const board = emptyBoard(spec.rows, spec.cols);
    let planted = false;

    for (const action of acts) {
      if (action.kind === "reveal") {
        const cell = board[action.r]?.[action.c];
        if (!cell || cell.revealed || cell.flagged) continue;
        if (!planted) {
          // First reveal plants. Game guarantees first click is safe — not a
          // guess by construction.
          plant(board, spec.mines, game.seed, action.r, action.c);
          planted = true;
          engineReveal(board, action.r, action.c);
          totalReveals += 1;
          deductedReveals += 1;
          continue;
        }
        const report = detectCoach(board);
        const wasProvenSafe = report.conclusions.some(
          (c) => c.kind === "safe" && c.r === action.r && c.c === action.c,
        );
        totalReveals += 1;
        if (wasProvenSafe) {
          deductedReveals += 1;
        } else {
          guesses += 1;
          if (cell.mine) guessBusts += 1;
        }
        engineReveal(board, action.r, action.c);
      } else if (action.kind === "chord") {
        // Chord on a satisfied number is a deductive move by definition —
        // doesn't need a separate coach check. We just apply it.
        const cell = board[action.r]?.[action.c];
        if (cell && cell.revealed && cell.adj > 0) {
          engineChord(board, action.r, action.c);
        }
      } else if (action.kind === "flag") {
        const cell = board[action.r]?.[action.c];
        if (cell && !cell.flagged && !cell.revealed) {
          engineFlag(board, action.r, action.c);
        }
      } else if (action.kind === "unflag") {
        const cell = board[action.r]?.[action.c];
        if (cell && cell.flagged) engineFlag(board, action.r, action.c);
      }
    }
  }

  return {
    totalReveals,
    deductedReveals,
    guesses,
    guessBusts,
    guessSuccessRate: guesses > 0 ? (guesses - guessBusts) / guesses : 0,
    deductionRate:
      totalReveals > 0 ? deductedReveals / totalReveals : 0,
  };
}

function computeAvgTimeToFirstBoom(games: Game[]): number | null {
  let sum = 0;
  let n = 0;
  for (const g of games) {
    if (g.won) continue;
    const acts = g.actions;
    if (!Array.isArray(acts) || acts.length < 1) continue;
    // The last logged action of a lost game is the boom. atMs gives us how
    // long the player survived from the first reveal (which sets atMs=0).
    const last = (acts as ActionLogEntry[])[acts.length - 1];
    if (typeof last.atMs !== "number") continue;
    sum += last.atMs;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}
