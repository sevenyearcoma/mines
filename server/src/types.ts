import type { Socket } from "socket.io";
import type {
  CellEvent,
  ClientToServerEvents,
  PlayerHandle,
  RoundEndPayload,
  ScoreSnapshot,
  ServerToClientEvents,
} from "../../web/lib/multiplayer/protocol.js";
import type { RoundConfig, RoundResult } from "../../web/lib/engine/types.js";

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface ConnectedPlayer {
  socket: GameSocket;
  handle: PlayerHandle;
  inQueue: boolean;
  matchId: string | null;
}

export interface MatchPlayerState {
  handle: PlayerHandle;
  socketId: string;
  liveScore: ScoreSnapshot;
  result: RoundResult | null;
  // Append-only log of board actions this round. Streamed to opponent ONLY
  // after the opponent reaches a terminal state (spectator mode).
  cellLog: CellEvent[];
  // True once the opponent has been told they can spectate this player.
  spectatorOpen: boolean;
}

export type MatchStatus = "in_round" | "between_rounds" | "complete";

export interface MatchSession {
  id: string;
  players: [MatchPlayerState, MatchPlayerState];
  seeds: number[];
  baseConfig: Omit<RoundConfig, "seed" | "roundIndex" | "matchId">;
  roundIndex: number;
  roundStartedAt: number;
  roundTimer: NodeJS.Timeout | null;
  betweenTimer: NodeJS.Timeout | null;
  roundsWon: [number, number];
  status: MatchStatus;
}

export type { RoundEndPayload };
