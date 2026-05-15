import type {
  ActionLogEntry,
  Difficulty,
  RoundConfig,
  ScoreState,
} from "@/lib/engine";

export const SOLO_PROGRESS_VERSION = 1;

export type SerializedSoloCell = {
  m: boolean;
  a: number;
  r: boolean;
  f: boolean;
};

export type SoloProgressSnapshot = {
  version: typeof SOLO_PROGRESS_VERSION;
  difficulty: Difficulty;
  round: RoundConfig;
  board: {
    rows: number;
    cols: number;
    cells: SerializedSoloCell[];
  };
  planted: boolean;
  elapsedMs: number | null;
  gameOver: boolean;
  won: boolean;
  opens: number;
  clicks: number;
  chains: number;
  lives: number;
  stunnedUntilMs: number | null;
  streak: number;
  streakBest: number;
  actions: ActionLogEntry[];
  scoreState: ScoreState;
  updatedAt: string;
};

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && DIFFICULTIES.includes(value as Difficulty);
}

export function isSoloProgressSnapshot(
  value: unknown,
  difficulty?: Difficulty,
): value is SoloProgressSnapshot {
  if (!isRecord(value)) return false;
  if (value.version !== SOLO_PROGRESS_VERSION) return false;
  if (!isDifficulty(value.difficulty)) return false;
  if (difficulty && value.difficulty !== difficulty) return false;
  if (!isRecord(value.round)) return false;
  if (value.round.mode !== "casual") return false;
  if (value.round.difficulty !== value.difficulty) return false;
  if (!isRecord(value.board)) return false;
  const rows = value.board.rows;
  const cols = value.board.cols;
  const cells = value.board.cells;
  if (typeof rows !== "number" || typeof cols !== "number") return false;
  if (!Array.isArray(cells) || cells.length !== rows * cols) return false;
  if (rows !== value.round.rows || cols !== value.round.cols) return false;
  if (typeof value.round.mines !== "number") return false;
  if (typeof value.round.seed !== "number") return false;
  if (typeof value.planted !== "boolean") return false;
  if (value.elapsedMs !== null && typeof value.elapsedMs !== "number") return false;
  if (typeof value.gameOver !== "boolean") return false;
  if (typeof value.won !== "boolean") return false;
  if (typeof value.opens !== "number") return false;
  if (typeof value.clicks !== "number") return false;
  if (typeof value.chains !== "number") return false;
  if (typeof value.lives !== "number") return false;
  if (
    value.stunnedUntilMs !== null &&
    typeof value.stunnedUntilMs !== "number"
  ) {
    return false;
  }
  if (typeof value.streak !== "number") return false;
  if (typeof value.streakBest !== "number") return false;
  if (!Array.isArray(value.actions)) return false;
  if (!isRecord(value.scoreState)) return false;
  if (typeof value.updatedAt !== "string") return false;
  return true;
}
