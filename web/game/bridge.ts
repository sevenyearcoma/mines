import mitt from "mitt";
import type {
  Difficulty,
  RoundConfig,
  RoundResult,
  ScoreBreakdown,
} from "@/lib/engine";
import type { CellEvent } from "@/lib/multiplayer/protocol";

// Snapshot of the *own* board at the moment of death, surfaced to React for
// the side mini-board.
export interface BoardSnapshot {
  rows: number;
  cols: number;
  // r * cols + c → tile state. -1 = covered, -2 = flagged, -3 = mine, else adj 0-8.
  cells: Int8Array;
  boom: { r: number; c: number } | null;
}

export type GameStats = {
  elapsedMs: number;
  opens: number;
  clicks: number;
  chains: number;
  flagged: number;
  remaining: number;
  streak: number;            // casual cross-game win streak (legacy)
  streakBest: number;        // casual cross-game best streak (legacy)
  difficulty: Difficulty;
  seed: number;
  score: ScoreBreakdown;
  liveStreak: number;        // current in-round reveal streak (resets on hesitation)
  liveMultiplier: number;    // current in-round score multiplier
  timeLeftMs: number | null;
  cellsRevealed: number;     // safe non-mine cells uncovered this round
};

export type GameOverPayload = {
  won: boolean;
  elapsedMs: number;
  opens: number;
  clicks: number;
  flagged: number;
  postLossHintCount: number;
  boomCell?: { r: number; c: number };
};

type Events = {
  // Phaser -> React (legacy casual)
  "stats:update": GameStats;
  "game:start": { difficulty: Difficulty; seed: number };
  "game:reset": void;
  "game:over": GameOverPayload;

  // Phaser -> React (round / PvP)
  "round:start": { config: RoundConfig };
  "round:end": RoundResult;
  "score:update": ScoreBreakdown;
  // Streamed every player action so the multiplayer layer can forward to the
  // server for spectator replay. Batched per local action (one reveal can
  // produce many cells via flood fill).
  "cells:events": CellEvent[];
  // Snapshot of own board at the moment of death — drives the side mini-board.
  "board:snapshot": BoardSnapshot;

  // sound triggers (Phaser -> SoundDirector)
  "sound:reveal": { count: number };
  "sound:flag": { on: boolean };
  "sound:chord": void;
  "sound:boom": void;
  "sound:win": void;

  // React -> Phaser
  "cmd:reset": void;
  "cmd:setDifficulty": Difficulty;
  "cmd:loadRound": RoundConfig;
  "cmd:setMuted": boolean;
  "cmd:setVolume": number;
  // Switch the running scene into spectator mode: clears local board, freezes
  // input, then incoming `cmd:applyRemoteEvents` are rendered as opponent
  // moves.
  "cmd:enterSpectator": { opponentName: string };
  "cmd:applyRemoteEvents": CellEvent[];
};

export const bridge = mitt<Events>();
