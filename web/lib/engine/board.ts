import { rng } from "./rng";
import type { Board, ChordResult, RevealResult } from "./types";

export function emptyBoard(rows: number, cols: number): Board {
  const cells: Board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ r, c, mine: false, adj: 0, revealed: false, flagged: false });
    }
    cells.push(row);
  }
  return cells;
}

// Plant mines, avoiding the 3x3 safe area around first click.
export function plant(
  board: Board,
  mines: number,
  seed: number,
  safeR: number,
  safeC: number,
): void {
  const rows = board.length;
  const cols = board[0].length;
  const r = rng(seed);
  const safe = new Set<number>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      safe.add((safeR + dr) * cols + (safeC + dc));
    }
  }
  let placed = 0;
  const total = rows * cols;
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (const idx of indices) {
    if (placed >= mines) break;
    if (safe.has(idx)) continue;
    const rr = Math.floor(idx / cols);
    const cc = idx % cols;
    board[rr][cc].mine = true;
    placed++;
  }
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (board[rr][cc].mine) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = rr + dr;
          const nc = cc + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          if (board[nr][nc].mine) n++;
        }
      }
      board[rr][cc].adj = n;
    }
  }
}

// Flood-fill reveal on 0-cells. Returns BFS distance per revealed cell.
export function reveal(board: Board, r: number, c: number): RevealResult {
  const rows = board.length;
  const cols = board[0].length;
  const start = board[r][c];
  if (start.revealed || start.flagged) {
    return { revealed: [], hitMine: false, anyRevealed: false };
  }
  if (start.mine) {
    start.revealed = true;
    return { revealed: [{ r, c, dist: 0 }], hitMine: true, anyRevealed: true };
  }
  const out: { r: number; c: number; dist: number }[] = [];
  const queue: [number, number, number][] = [[r, c, 0]];
  const seen = new Set<number>([r * cols + c]);
  while (queue.length) {
    const [cr, cc, dist] = queue.shift()!;
    const cell = board[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    out.push({ r: cr, c: cc, dist });
    if (cell.adj === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const k = nr * cols + nc;
          if (seen.has(k)) continue;
          seen.add(k);
          queue.push([nr, nc, dist + 1]);
        }
      }
    }
  }
  return { revealed: out, hitMine: false, anyRevealed: out.length > 0 };
}

// Chord: if a number cell has exactly N flagged neighbors, reveal the rest.
export function chord(board: Board, r: number, c: number): ChordResult {
  const cell = board[r][c];
  if (!cell.revealed || cell.adj === 0) return { revealed: [], hitMine: false };
  const rows = board.length;
  const cols = board[0].length;
  let flagCount = 0;
  const toReveal: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const n = board[nr][nc];
      if (n.flagged) flagCount++;
      else if (!n.revealed) toReveal.push([nr, nc]);
    }
  }
  if (flagCount !== cell.adj) return { revealed: [], hitMine: false };
  let hit = false;
  const all: { r: number; c: number; dist: number }[] = [];
  for (const [nr, nc] of toReveal) {
    const res = reveal(board, nr, nc);
    if (res.hitMine) hit = true;
    all.push(...res.revealed);
  }
  return { revealed: all, hitMine: hit };
}

export function flag(board: Board, r: number, c: number): boolean {
  const cell = board[r][c];
  if (cell.revealed) return false;
  cell.flagged = !cell.flagged;
  return cell.flagged;
}

export function isWin(board: Board): boolean {
  let unrevealed = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell.revealed && !cell.mine) unrevealed++;
    }
  }
  return unrevealed === 0;
}

export function countFlags(board: Board): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell.flagged) n++;
  return n;
}

export function revealAllMines(board: Board): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell.mine && !cell.revealed && !cell.flagged) {
        cell.revealed = true;
        out.push({ r: cell.r, c: cell.c });
      }
    }
  }
  return out;
}

// "Could have known safe" — cells adjacent to a satisfied number cell that
// aren't revealed and aren't mines. Post-loss probability-thinking hint.
export function deducibleSafe(board: Board): { r: number; c: number }[] {
  const rows = board.length;
  const cols = board[0].length;
  const safeSet = new Set<number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (!cell.revealed || cell.adj === 0) continue;
      let flags = 0;
      const closed: typeof cell[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const n = board[nr][nc];
          if (n.flagged) flags++;
          else if (!n.revealed) closed.push(n);
        }
      }
      if (flags === cell.adj) {
        for (const n of closed) if (!n.mine) safeSet.add(n.r * cols + n.c);
      }
    }
  }
  return [...safeSet].map((k) => ({ r: Math.floor(k / cols), c: k % cols }));
}
