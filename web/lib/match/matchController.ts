import {
  MATCH_ROUND_TIME_MS,
  newSeed,
  type RoundConfig,
  type RoundResult,
} from "@/lib/engine";

export const MATCH_FORMAT = {
  rounds: 5,
  winsNeeded: 3,
} as const;

export type PlayerIndex = 0 | 1;

// Local-only PvP prep: only player 0 is real. Player 1 is a placeholder until
// a server feeds in their score. For now, deciding the round winner uses the
// player's RoundEndReason — a clean clear wins the round, anything else loses.
// Replacing this with `result.score.total > opponentScore.total` is the
// single-line change that lands when sockets come online.
export interface MatchSnapshot {
  matchId: string;
  baseConfig: Omit<RoundConfig, "seed" | "roundIndex" | "matchId">;
  seeds: number[];
  roundIndex: number;
  results: (RoundResult | null)[];
  roundWinners: (PlayerIndex | null)[];
  roundsWon: [number, number];
  status: "idle" | "in_progress" | "complete";
  winner: PlayerIndex | null;
}

function defaultBaseConfig(): MatchSnapshot["baseConfig"] {
  return {
    rows: 16,
    cols: 16,
    mines: 40,
    timeLimitMs: MATCH_ROUND_TIME_MS,
    mode: "match",
    maxLives: 2,
    prePlant: { r: 8, c: 8 },
  };
}

export function freshMatch(matchId: string): MatchSnapshot {
  const base = defaultBaseConfig();
  const seeds = Array.from({ length: MATCH_FORMAT.rounds }, () => newSeed());
  return {
    matchId,
    baseConfig: base,
    seeds,
    roundIndex: 0,
    results: Array(MATCH_FORMAT.rounds).fill(null),
    roundWinners: Array(MATCH_FORMAT.rounds).fill(null),
    roundsWon: [0, 0],
    status: "in_progress",
    winner: null,
  };
}

export function currentRoundConfig(snap: MatchSnapshot): RoundConfig | null {
  if (snap.status !== "in_progress") return null;
  if (snap.roundIndex >= MATCH_FORMAT.rounds) return null;
  return {
    ...snap.baseConfig,
    seed: snap.seeds[snap.roundIndex],
    roundIndex: snap.roundIndex,
    matchId: snap.matchId,
  };
}

export function recordRoundResult(
  snap: MatchSnapshot,
  result: RoundResult,
): MatchSnapshot {
  const idx = snap.roundIndex;
  if (idx >= MATCH_FORMAT.rounds) return snap;

  const winner: PlayerIndex = result.reason === "won" ? 0 : 1;
  const roundWinners = [...snap.roundWinners];
  roundWinners[idx] = winner;
  const results = [...snap.results];
  results[idx] = result;

  const roundsWon: [number, number] = [snap.roundsWon[0], snap.roundsWon[1]];
  roundsWon[winner] += 1;

  const nextIdx = idx + 1;
  const matchOver =
    roundsWon[0] >= MATCH_FORMAT.winsNeeded ||
    roundsWon[1] >= MATCH_FORMAT.winsNeeded ||
    nextIdx >= MATCH_FORMAT.rounds;

  let matchWinner: PlayerIndex | null = null;
  if (matchOver) {
    if (roundsWon[0] > roundsWon[1]) matchWinner = 0;
    else if (roundsWon[1] > roundsWon[0]) matchWinner = 1;
  }

  return {
    ...snap,
    results,
    roundWinners,
    roundsWon,
    roundIndex: nextIdx,
    status: matchOver ? "complete" : "in_progress",
    winner: matchWinner,
  };
}
