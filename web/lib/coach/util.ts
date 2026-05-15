import type { BoardRef, Constraint } from "./types";

export function neighbors(r: number, c: number, rows: number, cols: number) {
  const out: { r: number; c: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      out.push({ r: nr, c: nc });
    }
  }
  return out;
}

export function inBounds(
  board: BoardRef,
  r: number,
  c: number,
): boolean {
  return r >= 0 && c >= 0 && r < board.length && c < board[0].length;
}

// A cell that "blocks" a pattern's reasoning from leaking. For named
// patterns (1-2-1, 1-2-2-1, 1-1) to derive the correct conclusions we need
// to be sure the involved numbers' mine cones are EXACTLY the target cells —
// no extra known mines anywhere else around them. A revealed *number* (or a
// 0) satisfies that: it can't be a mine and adds no obligation. A wall does
// too. Flags and revealed-mines do NOT, because they each contribute one
// known mine to whichever number they're adjacent to, and the pattern's
// arithmetic was derived assuming no such extra mines.
export function isBlockingForPattern(
  board: BoardRef,
  r: number,
  c: number,
): boolean {
  if (!inBounds(board, r, c)) return true;
  const cell = board[r][c];
  return cell.revealed && !cell.mine;
}

// Closed + unflagged — the kind of cell a pattern wants on its "active" side.
export function isClosed(
  board: BoardRef,
  r: number,
  c: number,
): boolean {
  if (!inBounds(board, r, c)) return false;
  const cell = board[r][c];
  return !cell.revealed && !cell.flagged;
}

// Revealed cell with the given exact value.
export function isNumber(
  board: BoardRef,
  r: number,
  c: number,
  value: number,
): boolean {
  if (!inBounds(board, r, c)) return false;
  const cell = board[r][c];
  return cell.revealed && !cell.mine && cell.adj === value;
}

// Build a constraint for each revealed-number cell on the board. Mine cells
// and 0-cells are skipped — they have nothing to teach.
//
// The `flagged` field on Constraint represents "known mines" — both explicit
// flag marks AND revealed mines (detonated bombs in multi-life mode count
// just like flags toward whether the number is satisfied).
export function buildConstraints(board: BoardRef): Constraint[] {
  const rows = board.length;
  const cols = board[0].length;
  const out: Constraint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (!cell.revealed || cell.mine || cell.adj === 0) continue;
      const flagged: { r: number; c: number }[] = [];
      const closed: { r: number; c: number }[] = [];
      for (const n of neighbors(r, c, rows, cols)) {
        const nc = board[n.r][n.c];
        // Known mine: explicit flag OR detonated bomb (revealed && mine).
        if (nc.flagged || (nc.revealed && nc.mine)) flagged.push(n);
        else if (!nc.revealed) closed.push(n);
      }
      out.push({ r, c, value: cell.adj, flagged, closed });
    }
  }
  return out;
}
