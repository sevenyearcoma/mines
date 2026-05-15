// Visually-recognized Minesweeper patterns. These deductions don't follow
// from a single number's constraints — they require the *combination* of
// constraints across multiple revealed numbers. Hardcoded as templates so
// the coach can name them when the player sees the same shape on a real
// board.

import type { BoardRef, PatternMatch } from "./types";
import { isBlockingForPattern, isClosed, isNumber } from "./util";

// ---------------------------------------------------------------------------
// 1-2-1
// ---------------------------------------------------------------------------
//
// Three revealed numbers in a row spelling 1-2-1 with closed cells on one
// side and walls/revealed cells on the other. The mines live directly
// opposite the 1s; the cell opposite the 2 is safe.
//
//   . 1 2 1 .       The dots represent revealed/wall cells.
//   . ? ? ? .       The ?s are closed (unrevealed, unflagged).
//   mine safe mine on the closed side.

export function detect121(board: BoardRef): PatternMatch[] {
  const rows = board.length;
  const cols = board[0].length;
  const out: PatternMatch[] = [];
  // Two axes × two sides each = 4 orientations.
  // Horizontal: numbers along the row, closed side ±1 in r.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 3; c++) {
      if (
        !isNumber(board, r, c, 1) ||
        !isNumber(board, r, c + 1, 2) ||
        !isNumber(board, r, c + 2, 1)
      )
        continue;
      for (const dr of [1, -1] as const) {
        if (matchAndPush121Horizontal(board, r, c, dr, out)) break;
      }
    }
  }
  // Vertical: numbers along the column, closed side ±1 in c.
  for (let r = 0; r <= rows - 3; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        !isNumber(board, r, c, 1) ||
        !isNumber(board, r + 1, c, 2) ||
        !isNumber(board, r + 2, c, 1)
      )
        continue;
      for (const dc of [1, -1] as const) {
        if (matchAndPush121Vertical(board, r, c, dc, out)) break;
      }
    }
  }
  return out;
}

function matchAndPush121Horizontal(
  board: BoardRef,
  r: number,
  c: number,
  dr: 1 | -1,
  out: PatternMatch[],
): boolean {
  // Closed targets: (r+dr, c), (r+dr, c+1), (r+dr, c+2).
  // Everything else around the 1-2-1 must be blocking (revealed / wall / flag).
  const targets = [
    { r: r + dr, c },
    { r: r + dr, c: c + 1 },
    { r: r + dr, c: c + 2 },
  ];
  for (const t of targets) {
    if (!isClosed(board, t.r, t.c)) return false;
  }
  const blockers = [
    { r: r - dr, c: c - 1 },
    { r: r - dr, c },
    { r: r - dr, c: c + 1 },
    { r: r - dr, c: c + 2 },
    { r: r - dr, c: c + 3 },
    { r, c: c - 1 },
    { r, c: c + 3 },
    { r: r + dr, c: c - 1 },
    { r: r + dr, c: c + 3 },
  ];
  for (const b of blockers) {
    if (!isBlockingForPattern(board, b.r, b.c)) return false;
  }
  out.push({
    id: `121-h-${r}-${c}-${dr}`,
    name: "1-2-1",
    shortLabel: "1-2-1",
    explanation:
      "1-2-1 in a row with closed cells only on one side: the two cells opposite the 1s are mines, the cell opposite the 2 is safe.",
    anchors: [
      { r, c },
      { r, c: c + 1 },
      { r, c: c + 2 },
    ],
    conclusions: [
      { kind: "mine", r: r + dr, c },
      { kind: "safe", r: r + dr, c: c + 1 },
      { kind: "mine", r: r + dr, c: c + 2 },
    ],
  });
  return true;
}

function matchAndPush121Vertical(
  board: BoardRef,
  r: number,
  c: number,
  dc: 1 | -1,
  out: PatternMatch[],
): boolean {
  const targets = [
    { r, c: c + dc },
    { r: r + 1, c: c + dc },
    { r: r + 2, c: c + dc },
  ];
  for (const t of targets) {
    if (!isClosed(board, t.r, t.c)) return false;
  }
  const blockers = [
    { r: r - 1, c: c - dc },
    { r, c: c - dc },
    { r: r + 1, c: c - dc },
    { r: r + 2, c: c - dc },
    { r: r + 3, c: c - dc },
    { r: r - 1, c },
    { r: r + 3, c },
    { r: r - 1, c: c + dc },
    { r: r + 3, c: c + dc },
  ];
  for (const b of blockers) {
    if (!isBlockingForPattern(board, b.r, b.c)) return false;
  }
  out.push({
    id: `121-v-${r}-${c}-${dc}`,
    name: "1-2-1",
    shortLabel: "1-2-1",
    explanation:
      "1-2-1 in a column with closed cells only on one side: the cells opposite the 1s are mines, the cell opposite the 2 is safe.",
    anchors: [
      { r, c },
      { r: r + 1, c },
      { r: r + 2, c },
    ],
    conclusions: [
      { kind: "mine", r, c: c + dc },
      { kind: "safe", r: r + 1, c: c + dc },
      { kind: "mine", r: r + 2, c: c + dc },
    ],
  });
  return true;
}

// ---------------------------------------------------------------------------
// 1-2-2-1
// ---------------------------------------------------------------------------
//
//   . 1 2 2 1 .
//   . ? ? ? ? .
//   safe mine mine safe  on the closed side, directly opposite each number.
//   (The cells beyond the 1s, one extra column out, are also safe.)

export function detect1221(board: BoardRef): PatternMatch[] {
  const rows = board.length;
  const cols = board[0].length;
  const out: PatternMatch[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      if (
        !isNumber(board, r, c, 1) ||
        !isNumber(board, r, c + 1, 2) ||
        !isNumber(board, r, c + 2, 2) ||
        !isNumber(board, r, c + 3, 1)
      )
        continue;
      for (const dr of [1, -1] as const) {
        if (matchAndPush1221Horizontal(board, r, c, dr, out)) break;
      }
    }
  }
  for (let r = 0; r <= rows - 4; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        !isNumber(board, r, c, 1) ||
        !isNumber(board, r + 1, c, 2) ||
        !isNumber(board, r + 2, c, 2) ||
        !isNumber(board, r + 3, c, 1)
      )
        continue;
      for (const dc of [1, -1] as const) {
        if (matchAndPush1221Vertical(board, r, c, dc, out)) break;
      }
    }
  }
  return out;
}

function matchAndPush1221Horizontal(
  board: BoardRef,
  r: number,
  c: number,
  dr: 1 | -1,
  out: PatternMatch[],
): boolean {
  const targets = [
    { r: r + dr, c },
    { r: r + dr, c: c + 1 },
    { r: r + dr, c: c + 2 },
    { r: r + dr, c: c + 3 },
  ];
  for (const t of targets) {
    if (!isClosed(board, t.r, t.c)) return false;
  }
  const blockers = [
    { r: r - dr, c: c - 1 },
    { r: r - dr, c },
    { r: r - dr, c: c + 1 },
    { r: r - dr, c: c + 2 },
    { r: r - dr, c: c + 3 },
    { r: r - dr, c: c + 4 },
    { r, c: c - 1 },
    { r, c: c + 4 },
    { r: r + dr, c: c - 1 },
    { r: r + dr, c: c + 4 },
  ];
  for (const b of blockers) {
    if (!isBlockingForPattern(board, b.r, b.c)) return false;
  }
  out.push({
    id: `1221-h-${r}-${c}-${dr}`,
    name: "1-2-2-1",
    shortLabel: "1-2-2-1",
    explanation:
      "1-2-2-1 in a row with closed cells only on one side: the two cells opposite the 2s are mines, the cells opposite the 1s are safe.",
    anchors: [
      { r, c },
      { r, c: c + 1 },
      { r, c: c + 2 },
      { r, c: c + 3 },
    ],
    conclusions: [
      { kind: "safe", r: r + dr, c },
      { kind: "mine", r: r + dr, c: c + 1 },
      { kind: "mine", r: r + dr, c: c + 2 },
      { kind: "safe", r: r + dr, c: c + 3 },
    ],
  });
  return true;
}

function matchAndPush1221Vertical(
  board: BoardRef,
  r: number,
  c: number,
  dc: 1 | -1,
  out: PatternMatch[],
): boolean {
  const targets = [
    { r, c: c + dc },
    { r: r + 1, c: c + dc },
    { r: r + 2, c: c + dc },
    { r: r + 3, c: c + dc },
  ];
  for (const t of targets) {
    if (!isClosed(board, t.r, t.c)) return false;
  }
  const blockers = [
    { r: r - 1, c: c - dc },
    { r, c: c - dc },
    { r: r + 1, c: c - dc },
    { r: r + 2, c: c - dc },
    { r: r + 3, c: c - dc },
    { r: r + 4, c: c - dc },
    { r: r - 1, c },
    { r: r + 4, c },
    { r: r - 1, c: c + dc },
    { r: r + 4, c: c + dc },
  ];
  for (const b of blockers) {
    if (!isBlockingForPattern(board, b.r, b.c)) return false;
  }
  out.push({
    id: `1221-v-${r}-${c}-${dc}`,
    name: "1-2-2-1",
    shortLabel: "1-2-2-1",
    explanation:
      "1-2-2-1 in a column with closed cells only on one side: the cells opposite the 2s are mines, the cells opposite the 1s are safe.",
    anchors: [
      { r, c },
      { r: r + 1, c },
      { r: r + 2, c },
      { r: r + 3, c },
    ],
    conclusions: [
      { kind: "safe", r, c: c + dc },
      { kind: "mine", r: r + 1, c: c + dc },
      { kind: "mine", r: r + 2, c: c + dc },
      { kind: "safe", r: r + 3, c: c + dc },
    ],
  });
  return true;
}

// ---------------------------------------------------------------------------
// 1-1 along a wall / revealed edge
// ---------------------------------------------------------------------------
//
//   . 1 1 ? .
//   . ? ? ? ? .
//
// Two adjacent 1s with all unrevealed mass on the same side, and the cell
// at the FAR side of the second 1 (along the row) is the only "extra"
// neighbour. The first 1's mine must fall inside its closed pair; the
// second 1 sees the same two cells plus one extra — the extra is safe.

export function detect11Wall(board: BoardRef): PatternMatch[] {
  const rows = board.length;
  const cols = board[0].length;
  const out: PatternMatch[] = [];
  // Horizontal pair
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 2; c++) {
      if (!isNumber(board, r, c, 1) || !isNumber(board, r, c + 1, 1)) continue;
      // For each closed-side row (above/below)
      for (const dr of [1, -1] as const) {
        // Two orientations of the "extra" cell: at (r, c-1) or (r, c+2).
        // The far one must be closed; the near one must be blocking (the
        // anchored 1 is the one whose mine cone is contained).
        tryWall11(
          board,
          out,
          {
            anchorA: { r, c },          // contained 1 (mine cone fully inside pair)
            anchorB: { r, c: c + 1 },   // extending 1 (has the extra cell)
            insideCells: [
              { r: r + dr, c },
              { r: r + dr, c: c + 1 },
            ],
            extraCell: { r, c: c + 2 },     // safe cell
            sameSideExtraNeighbour: { r: r + dr, c: c + 2 },
            blockingForA: [
              { r: r - dr, c: c - 1 },
              { r: r - dr, c },
              { r: r - dr, c: c + 1 },
              { r, c: c - 1 },
              { r: r + dr, c: c - 1 },
            ],
            mustBeClosedForA: [
              { r: r + dr, c },
              { r: r + dr, c: c + 1 },
            ],
            blockingForBOutside: [
              { r: r - dr, c },
              { r: r - dr, c: c + 1 },
              { r: r - dr, c: c + 2 },
            ],
            kind: "horizontal",
            dr,
            dc: 1,
          },
        );
        tryWall11(
          board,
          out,
          {
            anchorA: { r, c: c + 1 },
            anchorB: { r, c },
            insideCells: [
              { r: r + dr, c },
              { r: r + dr, c: c + 1 },
            ],
            extraCell: { r, c: c - 1 },
            sameSideExtraNeighbour: { r: r + dr, c: c - 1 },
            blockingForA: [
              { r: r - dr, c },
              { r: r - dr, c: c + 1 },
              { r: r - dr, c: c + 2 },
              { r, c: c + 2 },
              { r: r + dr, c: c + 2 },
            ],
            mustBeClosedForA: [
              { r: r + dr, c },
              { r: r + dr, c: c + 1 },
            ],
            blockingForBOutside: [
              { r: r - dr, c: c - 1 },
              { r: r - dr, c },
              { r: r - dr, c: c + 1 },
            ],
            kind: "horizontal",
            dr,
            dc: -1,
          },
        );
      }
    }
  }
  // Vertical pair — symmetric.
  for (let r = 0; r <= rows - 2; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isNumber(board, r, c, 1) || !isNumber(board, r + 1, c, 1)) continue;
      for (const dc of [1, -1] as const) {
        tryWall11(
          board,
          out,
          {
            anchorA: { r, c },
            anchorB: { r: r + 1, c },
            insideCells: [
              { r, c: c + dc },
              { r: r + 1, c: c + dc },
            ],
            extraCell: { r: r + 2, c },
            sameSideExtraNeighbour: { r: r + 2, c: c + dc },
            blockingForA: [
              { r: r - 1, c: c - dc },
              { r, c: c - dc },
              { r: r + 1, c: c - dc },
              { r: r - 1, c },
              { r: r - 1, c: c + dc },
            ],
            mustBeClosedForA: [
              { r, c: c + dc },
              { r: r + 1, c: c + dc },
            ],
            blockingForBOutside: [
              { r: r + 2, c: c - dc },
            ],
            kind: "vertical",
            dr: 1,
            dc,
          },
        );
        tryWall11(
          board,
          out,
          {
            anchorA: { r: r + 1, c },
            anchorB: { r, c },
            insideCells: [
              { r, c: c + dc },
              { r: r + 1, c: c + dc },
            ],
            extraCell: { r: r - 1, c },
            sameSideExtraNeighbour: { r: r - 1, c: c + dc },
            blockingForA: [
              { r, c: c - dc },
              { r: r + 1, c: c - dc },
              { r: r + 2, c: c - dc },
              { r: r + 2, c },
              { r: r + 2, c: c + dc },
            ],
            mustBeClosedForA: [
              { r, c: c + dc },
              { r: r + 1, c: c + dc },
            ],
            blockingForBOutside: [
              { r: r - 1, c: c - dc },
            ],
            kind: "vertical",
            dr: -1,
            dc,
          },
        );
      }
    }
  }
  return out;
}

interface Wall11Spec {
  anchorA: { r: number; c: number };
  anchorB: { r: number; c: number };
  insideCells: { r: number; c: number }[];
  extraCell: { r: number; c: number };
  sameSideExtraNeighbour: { r: number; c: number };
  blockingForA: { r: number; c: number }[];
  mustBeClosedForA: { r: number; c: number }[];
  blockingForBOutside: { r: number; c: number }[];
  kind: "horizontal" | "vertical";
  dr: number;
  dc: number;
}

function tryWall11(
  board: BoardRef,
  out: PatternMatch[],
  spec: Wall11Spec,
): boolean {
  // A's mine cone must be exactly the two inside cells.
  for (const t of spec.mustBeClosedForA) {
    if (!isClosed(board, t.r, t.c)) return false;
  }
  for (const b of spec.blockingForA) {
    if (!isBlockingForPattern(board, b.r, b.c)) return false;
  }
  // B's outside (the far-side cells around B that are NOT the extra cell)
  // must be blocking — only then is `extraCell` the lone "extra" neighbour.
  for (const b of spec.blockingForBOutside) {
    if (!isBlockingForPattern(board, b.r, b.c)) return false;
  }
  // The extra cell and its same-side neighbour must be closed (else there's
  // nothing to mark safe).
  if (!isClosed(board, spec.extraCell.r, spec.extraCell.c)) return false;
  // The cell at the diagonal of B (same closed-side row) must also be closed
  // for the deduction to apply — it's the third "extra" neighbour of B.
  if (!isClosed(board, spec.sameSideExtraNeighbour.r, spec.sameSideExtraNeighbour.c))
    return false;

  out.push({
    id: `wall11-${spec.kind}-${spec.anchorA.r}-${spec.anchorA.c}-${spec.dr}-${spec.dc}`,
    name: "1-1 along wall",
    shortLabel: "1-1 wall",
    explanation:
      "Two 1s in a row whose mines must lie in the same pair of closed cells. The cell just past the pair, on the same side, is safe.",
    anchors: [spec.anchorA, spec.anchorB],
    conclusions: [
      { kind: "safe", r: spec.extraCell.r, c: spec.extraCell.c },
      {
        kind: "safe",
        r: spec.sameSideExtraNeighbour.r,
        c: spec.sameSideExtraNeighbour.c,
      },
    ],
  });
  return true;
}
