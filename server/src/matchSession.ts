import { randomBytes, randomUUID } from "node:crypto";
import type {
  CellEvent,
  MatchEndPayload,
  MatchStartPayload,
  RoundEndPayload,
  RoundStartPayload,
  ScoreSnapshot,
} from "../../web/lib/multiplayer/protocol.js";
import type {
  RoundConfig,
  RoundResult,
} from "../../web/lib/engine/types.js";
import type {
  ConnectedPlayer,
  MatchPlayerState,
  MatchSession,
} from "./types.js";
import { getMatch, removeMatch, setMatch } from "./registry.js";

const ROUND_TIME_MS = 120_000;       // 2 minutes per round (matches CLAUDE.md)
const ROUND_GRACE_MS = 250;          // server-side grace beyond client timer
const BETWEEN_ROUNDS_MS = 1500;      // pause between rounds for overlays
const MATCH_ROUNDS = 5;
const ROUND_WINS_NEEDED = 3;

function freshScoreSnapshot(): ScoreSnapshot {
  return {
    total: 0,
    liveMultiplier: 1,
    liveStreak: 0,
    status: "playing",
    cellsRevealed: 0,
  };
}

function newSeed(): number {
  // 32 bits is what the Mulberry32 PRNG consumes.
  return randomBytes(4).readUInt32LE(0);
}

function baseConfig(): MatchSession["baseConfig"] {
  return {
    rows: 16,
    cols: 16,
    mines: 40,
    timeLimitMs: ROUND_TIME_MS,
    mode: "match",
  };
}

function buildRoundConfig(match: MatchSession, idx: number): RoundConfig {
  return {
    ...match.baseConfig,
    seed: match.seeds[idx],
    roundIndex: idx,
    matchId: match.id,
  };
}

function buildPlayerState(p: ConnectedPlayer): MatchPlayerState {
  return {
    handle: p.handle,
    socketId: p.socket.id,
    liveScore: freshScoreSnapshot(),
    result: null,
    cellLog: [],
    spectatorOpen: false,
  };
}

// Indirection so matchSession can emit without taking an io dependency. Wired
// up at server bootstrap. `index.ts` owns the live socket map; we just hold
// socketIds and ask it to deliver. A disconnected target silently drops.
let sendFn: <T>(socketId: string, event: string, payload: T) => void = () => {
  console.warn("[matchSession] sendFn not wired");
};
export function configureSend(
  fn: <T>(socketId: string, event: string, payload: T) => void,
): void {
  sendFn = fn;
}

function send<T>(player: MatchPlayerState, event: string, payload: T): void {
  sendFn(player.socketId, event, payload);
}

export function createMatch(
  p1: ConnectedPlayer,
  p2: ConnectedPlayer,
): MatchSession {
  const id = randomUUID();
  const seeds = Array.from({ length: MATCH_ROUNDS }, newSeed);
  const match: MatchSession = {
    id,
    players: [buildPlayerState(p1), buildPlayerState(p2)],
    seeds,
    baseConfig: baseConfig(),
    roundIndex: 0,
    roundStartedAt: 0,
    roundTimer: null,
    betweenTimer: null,
    roundsWon: [0, 0],
    status: "in_round",
  };
  setMatch(match);
  p1.matchId = id;
  p1.inQueue = false;
  p2.matchId = id;
  p2.inQueue = false;

  // Tell both clients the match is on, then start round 0.
  for (const youAre of [0, 1] as const) {
    const player = match.players[youAre];
    const startPayload: MatchStartPayload = {
      matchId: id,
      players: [match.players[0].handle, match.players[1].handle],
      baseConfig: match.baseConfig,
      youAre,
    };
    send(player, "match:start", startPayload);
  }

  startRound(match);
  return match;
}

function startRound(match: MatchSession): void {
  match.status = "in_round";
  // Reset per-round state on both players.
  for (const p of match.players) {
    p.liveScore = freshScoreSnapshot();
    p.result = null;
    p.cellLog = [];
    p.spectatorOpen = false;
  }
  match.roundStartedAt = Date.now();

  const config = buildRoundConfig(match, match.roundIndex);
  const payload: RoundStartPayload = {
    matchId: match.id,
    roundIndex: match.roundIndex,
    config,
    startAt: match.roundStartedAt,
  };
  for (const p of match.players) send(p, "match:roundStart", payload);

  // Hard server-side deadline. Client timer is the source of truth for
  // gameplay, but we close the round here if anyone misses the report.
  if (match.roundTimer) clearTimeout(match.roundTimer);
  match.roundTimer = setTimeout(
    () => closeRound(match),
    ROUND_TIME_MS + ROUND_GRACE_MS,
  );
}

export function handleScoreTick(
  match: MatchSession,
  userId: string,
  roundIndex: number,
  snap: ScoreSnapshot,
): void {
  if (match.status !== "in_round") return;
  if (roundIndex !== match.roundIndex) return;
  const playerIdx = match.players.findIndex((p) => p.handle.id === userId);
  if (playerIdx < 0) return;

  match.players[playerIdx].liveScore = snap;
  const opponent = match.players[1 - playerIdx];
  send(opponent, "match:opponentScore", { roundIndex, ...snap });
}

export function handleRoundResult(
  match: MatchSession,
  userId: string,
  roundIndex: number,
  result: RoundResult,
): void {
  if (match.status !== "in_round") return;
  if (roundIndex !== match.roundIndex) return;
  const playerIdx = match.players.findIndex((p) => p.handle.id === userId);
  if (playerIdx < 0) return;
  // Idempotent: ignore duplicates.
  if (match.players[playerIdx].result) return;

  match.players[playerIdx].result = result;
  // Reflect terminal status in liveScore so the opponent's HUD shows it.
  match.players[playerIdx].liveScore = {
    total: result.score.total,
    liveMultiplier: result.score.peakMultiplier,
    liveStreak: result.score.peakStreak,
    status: terminalStatus(result),
    cellsRevealed: match.players[playerIdx].liveScore.cellsRevealed,
  };
  const opponent = match.players[1 - playerIdx];
  send(opponent, "match:opponentScore", {
    roundIndex,
    ...match.players[playerIdx].liveScore,
  });

  // This player just became terminal. If the opponent is still playing, open
  // the spectator channel: replay everything opponent has done so far.
  maybeOpenSpectator(match, playerIdx);

  if (match.players[0].result && match.players[1].result) {
    closeRound(match);
  }
}

// Forward a batch of board actions from `userId`'s player into the per-round
// cell log. If the opponent is already terminal (spectating), stream live.
export function handleCellEvents(
  match: MatchSession,
  userId: string,
  roundIndex: number,
  events: CellEvent[],
): void {
  if (match.status !== "in_round") return;
  if (roundIndex !== match.roundIndex) return;
  if (!events.length) return;
  const playerIdx = match.players.findIndex((p) => p.handle.id === userId);
  if (playerIdx < 0) return;
  const me = match.players[playerIdx];
  // Reject contributions after this player's own terminal — they shouldn't be
  // making board moves anymore, and we don't want to retro-feed them to the
  // opponent through any race.
  if (me.result) return;
  me.cellLog.push(...events);

  const opponent = match.players[1 - playerIdx];
  // Opponent gets the live stream only after they themselves are terminal.
  if (opponent.result && me.spectatorOpen) {
    send(opponent, "match:opponentCellEvents", { roundIndex, events });
  }
}

// When `terminalIdx` just became terminal, see if the OTHER player is still
// playing — if so, that other player is now the "watched" player from this
// one's POV, so we send the watched player's backlog to the dead player.
function maybeOpenSpectator(
  match: MatchSession,
  terminalIdx: number,
): void {
  const watcher = match.players[terminalIdx];        // now dead, wants to watch
  const watched = match.players[1 - terminalIdx];    // still alive, being watched
  if (watched.result) return;                        // both terminal — no spectate
  if (watched.spectatorOpen) return;                 // already streaming

  watched.spectatorOpen = true;
  send(watcher, "match:spectateStart", {
    roundIndex: match.roundIndex,
    opponentName: watched.handle.name,
    events: watched.cellLog.slice(),
  });
}

function terminalStatus(result: RoundResult): ScoreSnapshot["status"] {
  if (result.reason === "won") return "finished";
  if (result.reason === "exploded") return "exploded";
  return "timeout";
}

// Synthesize a minimal RoundResult for a player who never reported. Their
// live-tick total is the best score we have; everything else is zeroed out.
function synthesizeTimeout(
  match: MatchSession,
  playerIdx: number,
): RoundResult {
  const live = match.players[playerIdx].liveScore;
  const config = buildRoundConfig(match, match.roundIndex);
  const elapsedMs = Math.min(
    ROUND_TIME_MS,
    Date.now() - match.roundStartedAt,
  );
  return {
    config,
    reason: "timeout",
    elapsedMs,
    opens: 0,
    clicks: 0,
    chains: 0,
    flagged: 0,
    correctFlags: 0,
    misflags: 0,
    postLossHintCount: 0,
    score: {
      base: 0,
      combo: 0,
      speed: 0,
      peakStreak: live.liveStreak,
      peakMultiplier: live.liveMultiplier,
      total: live.total,
    },
    actions: [],
  };
}

function closeRound(match: MatchSession): void {
  if (match.status !== "in_round") return;

  if (match.roundTimer) {
    clearTimeout(match.roundTimer);
    match.roundTimer = null;
  }

  // Make sure both players have a result.
  for (let i = 0; i < 2; i++) {
    if (!match.players[i].result) {
      match.players[i].result = synthesizeTimeout(match, i);
    }
  }

  const r0 = match.players[0].result!;
  const r1 = match.players[1].result!;

  // Score-based winner. Ties don't award a point to either side.
  let winner: 0 | 1 | null = null;
  if (r0.score.total > r1.score.total) winner = 0;
  else if (r1.score.total > r0.score.total) winner = 1;

  if (winner !== null) match.roundsWon[winner] += 1;

  // Emit perspective-correct round:end to each player.
  const baseEnd: Omit<RoundEndPayload, "yourResult" | "opponentResult"> = {
    matchId: match.id,
    roundIndex: match.roundIndex,
    winner,
    roundsWon: [match.roundsWon[0], match.roundsWon[1]],
  };
  send(match.players[0], "match:roundEnd", {
    ...baseEnd,
    yourResult: r0,
    opponentResult: r1,
  });
  send(match.players[1], "match:roundEnd", {
    ...baseEnd,
    yourResult: r1,
    opponentResult: r0,
  });

  // Decide whether to advance or end the match.
  const someoneWon =
    match.roundsWon[0] >= ROUND_WINS_NEEDED ||
    match.roundsWon[1] >= ROUND_WINS_NEEDED;
  const lastRound = match.roundIndex >= MATCH_ROUNDS - 1;

  if (someoneWon || lastRound) {
    endMatch(match, "score");
    return;
  }

  match.status = "between_rounds";
  match.roundIndex += 1;
  if (match.betweenTimer) clearTimeout(match.betweenTimer);
  match.betweenTimer = setTimeout(() => {
    match.betweenTimer = null;
    // Player(s) may have disconnected during the overlay window.
    const stillExists = getMatch(match.id);
    if (!stillExists) return;
    startRound(match);
  }, BETWEEN_ROUNDS_MS);
}

function endMatch(match: MatchSession, reason: MatchEndPayload["reason"]): void {
  match.status = "complete";
  if (match.roundTimer) {
    clearTimeout(match.roundTimer);
    match.roundTimer = null;
  }
  if (match.betweenTimer) {
    clearTimeout(match.betweenTimer);
    match.betweenTimer = null;
  }

  let winner: 0 | 1 | null = null;
  if (match.roundsWon[0] > match.roundsWon[1]) winner = 0;
  else if (match.roundsWon[1] > match.roundsWon[0]) winner = 1;

  const payload: MatchEndPayload = {
    matchId: match.id,
    winner,
    roundsWon: [match.roundsWon[0], match.roundsWon[1]],
    reason,
  };
  for (const p of match.players) send(p, "match:end", payload);

  removeMatch(match.id);
}

// Called from the disconnect path when a player drops mid-match.
export function handleForfeit(match: MatchSession, leavingUserId: string): void {
  if (match.status === "complete") return;
  const leavingIdx = match.players.findIndex(
    (p) => p.handle.id === leavingUserId,
  );
  if (leavingIdx < 0) return;
  // Award the remaining wins needed to the staying player so winner resolves
  // unambiguously.
  const stayingIdx = (1 - leavingIdx) as 0 | 1;
  match.roundsWon[stayingIdx] = ROUND_WINS_NEEDED;
  endMatch(match, "forfeit");
}
