// AI coach pattern engine. The coach is a deterministic, rule-based scanner
// that surfaces logically-deducible moves on a given board state — no LLM,
// no inference cost.
//
// Coverage:
//   * "Satisfied N" — a numbered cell whose flagged-neighbour count already
//     equals its value. All remaining closed neighbours are safe.
//   * "Locked N" — a numbered cell whose remaining-mine count equals its
//     remaining-closed-neighbour count. Those closed neighbours are all mines.
//   * "1-2-1" — three numbers in a row spelling 1-2-1 with closed cells on
//     exactly one side. Cells beside the 1s are mines, cell beside the 2 is safe.
//   * "1-2-2-1" — four numbers spelling 1-2-2-1 in a line with closed cells
//     on one side. Cells beside the 2s are mines, the rest of that side is safe.
//   * "1-1 wall" — two 1s in a row touching a wall or revealed edge; the cell
//     after the second 1's wall-side neighbourhood is safe.
//
// The detector returns a deduplicated list of `Conclusion`s plus a per-pattern
// `PatternMatch` list (so the UI can both highlight the cells AND name the
// pattern). Deductions are deduplicated so a single cell never gets two
// conflicting markers.

import type { Board } from "@/lib/engine";

export type ConclusionKind = "safe" | "mine";

export interface Conclusion {
  kind: ConclusionKind;
  r: number;
  c: number;
  // PatternMatch ids that produced this conclusion (often just one).
  sources: string[];
}

export interface PatternMatch {
  id: string;                 // stable per board state (uses position + kind)
  name: string;               // "1-2-1", "satisfied 1", etc.
  shortLabel: string;         // tighter version for inline chips
  explanation: string;        // one-sentence why
  anchors: { r: number; c: number }[];  // revealed cells that triggered the pattern
  conclusions: Array<Omit<Conclusion, "sources">>;
}

export interface CoachReport {
  patterns: PatternMatch[];
  // Flattened, deduped conclusions ready for the overlay layer.
  conclusions: Conclusion[];
  // Quick stats for the side panel header.
  safeCount: number;
  mineCount: number;
}

// Internal: a "constraint" is a revealed numbered cell tracked for trivial
// rules + scratch state. Exported so utility files can share the shape.
export interface Constraint {
  r: number;
  c: number;
  value: number;
  flagged: { r: number; c: number }[];
  closed: { r: number; c: number }[];   // unrevealed, unflagged neighbours
}

export type BoardRef = Readonly<Board>;
