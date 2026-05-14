// Wire protocol for the socket.io multiplayer layer. Types only — must stay
// import-light because the server reads this file via a relative path and we
// don't want it dragging in @/ aliases or runtime code.

import type { RoundConfig, RoundResult } from "../engine/types";

export interface PlayerHandle {
  id: string;       // Supabase user id
  name: string;     // display name (profile.username, with sane fallback)
}

export type OpponentStatus =
  | "playing"
  | "exploded"
  | "finished"
  | "timeout";

export interface ScoreSnapshot {
  total: number;
  liveMultiplier: number;
  liveStreak: number;
  status: OpponentStatus;
  // Non-weaponizable progress signals: counts only, never positions.
  cellsRevealed: number;
}

export interface MatchStartPayload {
  matchId: string;
  players: [PlayerHandle, PlayerHandle];
  baseConfig: Omit<RoundConfig, "seed" | "roundIndex" | "matchId">;
  youAre: 0 | 1;
}

export interface RoundStartPayload {
  matchId: string;
  roundIndex: number;
  config: RoundConfig;
  startAt: number;     // server epoch ms; clients may sync stopwatch to this
}

export interface RoundEndPayload {
  matchId: string;
  roundIndex: number;
  yourResult: RoundResult;
  opponentResult: RoundResult;
  winner: 0 | 1 | null;
  roundsWon: [number, number];
}

export interface MatchEndPayload {
  matchId: string;
  winner: 0 | 1 | null;
  roundsWon: [number, number];
  reason: "score" | "forfeit";
}

export interface OpponentScorePayload extends ScoreSnapshot {
  roundIndex: number;
}

// One opponent action on the board. Streamed from each client to the server
// throughout a round; relayed to the OTHER player only once that player has
// reached a terminal state (exploded / finished / timed out) so live info
// cannot be weaponized while both are still playing.
export type CellEvent =
  | { kind: "reveal"; r: number; c: number; adj: number; mine?: boolean }
  | { kind: "flag"; r: number; c: number; on: boolean }
  | { kind: "boom"; r: number; c: number };

export interface CellEventBatch {
  roundIndex: number;
  events: CellEvent[];
}

export interface SpectateStartPayload {
  roundIndex: number;
  opponentName: string;
  events: CellEvent[];        // full backlog from the start of the round
}

export interface ClientToServerEvents {
  "queue:join": () => void;
  "queue:leave": () => void;
  "match:scoreTick": (p: { roundIndex: number; snap: ScoreSnapshot }) => void;
  "match:roundResult": (p: { roundIndex: number; result: RoundResult }) => void;
  "match:cellEvents": (p: CellEventBatch) => void;
  "match:leave": () => void;
}

export interface ServerToClientEvents {
  "queue:status": (p: { queued: boolean }) => void;
  "match:start": (p: MatchStartPayload) => void;
  "match:roundStart": (p: RoundStartPayload) => void;
  "match:opponentScore": (p: OpponentScorePayload) => void;
  "match:opponentCellEvents": (p: CellEventBatch) => void;
  "match:spectateStart": (p: SpectateStartPayload) => void;
  "match:roundEnd": (p: RoundEndPayload) => void;
  "match:end": (p: MatchEndPayload) => void;
  "match:error": (p: { code: string; message: string }) => void;
}

export type SocketAuth = {
  token: string;
};
