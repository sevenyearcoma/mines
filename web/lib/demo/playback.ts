// Playback engine for demo replay. Given a Demo, expose:
//   * the board state at a given action index
//   * helpers to step forward/back, jump by time, etc.
//
// We don't try to be clever with diffing or undo logs — for 16×16 boards with
// at most a couple hundred actions, "rebuild from scratch up to index N" is
// trivial (microseconds) and always correct.

import {
  chord as engineChord,
  emptyBoard,
  flag as engineFlag,
  plant,
  reveal as engineReveal,
  type ActionLogEntry,
  type Board,
} from "@/lib/engine";
import type { Demo } from "./types";

export interface PlaybackFrame {
  board: Board;
  // Index of the *next* action to apply. 0 = pristine state (after pre-plant
  // auto-reveal if any). actions.length = end-of-game.
  actionIndex: number;
  // ms within the round at the just-applied action (or 0 at pristine state).
  currentMs: number;
}

// Build a fully planted board at index 0 — for daily demos this also applies
// the auto-reveal at the prePlant cell, exactly like BoardScene.setupBoard.
// For solo demos there's no pre-plant; the first reveal action will plant.
function buildInitialBoard(demo: Demo): Board {
  const board = emptyBoard(demo.rows, demo.cols);
  if (demo.prePlant) {
    plant(board, demo.mines, demo.seed, demo.prePlant.r, demo.prePlant.c);
    engineReveal(board, demo.prePlant.r, demo.prePlant.c);
  }
  return board;
}

// Apply a single recorded action to a board. Handles the "first reveal also
// plants" case for solo demos — only valid the first time `reveal` is seen.
function applyAction(
  board: Board,
  demo: Demo,
  prevActions: ActionLogEntry[],
  action: ActionLogEntry,
): void {
  if (action.kind === "reveal") {
    // Plant lazily on first reveal for solo demos (no prePlant set).
    if (!demo.prePlant && prevActions.every((a) => a.kind !== "reveal")) {
      plant(board, demo.mines, demo.seed, action.r, action.c);
    }
    engineReveal(board, action.r, action.c);
  } else if (action.kind === "chord") {
    engineChord(board, action.r, action.c);
  } else if (action.kind === "flag") {
    const cell = board[action.r]?.[action.c];
    // engineFlag toggles; only set if currently not flagged so the recorded
    // "flag" intent is idempotent on rebuild.
    if (cell && !cell.flagged && !cell.revealed) engineFlag(board, action.r, action.c);
  } else if (action.kind === "unflag") {
    const cell = board[action.r]?.[action.c];
    if (cell && cell.flagged) engineFlag(board, action.r, action.c);
  }
}

// Build a board state from scratch up to (but not including) actions[index].
export function frameAt(demo: Demo, index: number): PlaybackFrame {
  const clamped = Math.max(0, Math.min(demo.actions.length, index));
  const board = buildInitialBoard(demo);
  for (let i = 0; i < clamped; i++) {
    applyAction(board, demo, demo.actions.slice(0, i), demo.actions[i]);
  }
  const currentMs =
    clamped === 0 ? 0 : demo.actions[clamped - 1].atMs;
  return { board, actionIndex: clamped, currentMs };
}

// Total duration: max of the last action timestamp and recorded elapsed_ms.
// We trust elapsed_ms more because mistake stuns happen between actions and
// the last action might be far before the end of the round.
export function totalMs(demo: Demo): number {
  const lastAction =
    demo.actions.length > 0 ? demo.actions[demo.actions.length - 1].atMs : 0;
  return Math.max(lastAction, demo.elapsed_ms);
}

// Find the action index that corresponds to a given playback time. Used by
// the scrubber: dragging to t=ms should land on the action whose atMs <= t.
export function indexForMs(demo: Demo, ms: number): number {
  let i = 0;
  while (
    i < demo.actions.length &&
    demo.actions[i].atMs <= ms
  ) {
    i++;
  }
  return i;
}
