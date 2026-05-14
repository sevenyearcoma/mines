// minesweeper-engine.js — pure game logic (no UI deps)

const Engine = (() => {
  const DIFFS = {
    beginner:     { rows: 9,  cols: 9,  mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert:       { rows: 16, cols: 30, mines: 99 },
  };

  // Mulberry32 — deterministic PRNG so seeds replay
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function emptyBoard(rows, cols) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r, c,
          mine: false,
          adj: 0,
          revealed: false,
          flagged: false,
        });
      }
      cells.push(row);
    }
    return cells;
  }

  // Plant mines, avoiding the 3x3 safe area around first click.
  function plant(board, mines, seed, safeR, safeC) {
    const rows = board.length, cols = board[0].length;
    const r = rng(seed);
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        safe.add((safeR + dr) * cols + (safeC + dc));
    let placed = 0;
    const total = rows * cols;
    // attempt: shuffle indices
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (const idx of indices) {
      if (placed >= mines) break;
      if (safe.has(idx)) continue;
      const rr = Math.floor(idx / cols), cc = idx % cols;
      board[rr][cc].mine = true;
      placed++;
    }
    // compute adjacency
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (board[rr][cc].mine) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = rr + dr, nc = cc + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            if (board[nr][nc].mine) n++;
          }
        board[rr][cc].adj = n;
      }
    }
  }

  // Reveal with cascade flood-fill on 0-cells.
  // Returns { revealed: [{r,c,dist}], hitMine, anyRevealed }
  function reveal(board, r, c) {
    const rows = board.length, cols = board[0].length;
    const start = board[r][c];
    if (start.revealed || start.flagged) return { revealed: [], hitMine: false, anyRevealed: false };
    if (start.mine) {
      start.revealed = true;
      return { revealed: [{r, c, dist: 0}], hitMine: true, anyRevealed: true };
    }
    const out = [];
    const queue = [[r, c, 0]];
    const seen = new Set([r * cols + c]);
    while (queue.length) {
      const [cr, cc, dist] = queue.shift();
      const cell = board[cr][cc];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      out.push({ r: cr, c: cc, dist });
      if (cell.adj === 0) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = cr + dr, nc = cc + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            const k = nr * cols + nc;
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push([nr, nc, dist + 1]);
          }
      }
    }
    return { revealed: out, hitMine: false, anyRevealed: out.length > 0 };
  }

  // Chord: if a number cell has exactly N flagged neighbors, reveal the rest.
  function chord(board, r, c) {
    const cell = board[r][c];
    if (!cell.revealed || cell.adj === 0) return { revealed: [], hitMine: false };
    const rows = board.length, cols = board[0].length;
    let flagCount = 0;
    const toReveal = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const n = board[nr][nc];
        if (n.flagged) flagCount++;
        else if (!n.revealed) toReveal.push([nr, nc]);
      }
    if (flagCount !== cell.adj) return { revealed: [], hitMine: false };
    let hit = false;
    const all = [];
    for (const [nr, nc] of toReveal) {
      const res = reveal(board, nr, nc);
      if (res.hitMine) hit = true;
      all.push(...res.revealed);
    }
    return { revealed: all, hitMine: hit };
  }

  function flag(board, r, c) {
    const cell = board[r][c];
    if (cell.revealed) return false;
    cell.flagged = !cell.flagged;
    return cell.flagged;
  }

  function isWin(board, totalMines) {
    let unrevealed = 0;
    for (const row of board)
      for (const cell of row)
        if (!cell.revealed && !cell.mine) unrevealed++;
    return unrevealed === 0;
  }

  function countFlags(board) {
    let n = 0;
    for (const row of board) for (const cell of row) if (cell.flagged) n++;
    return n;
  }

  // Reveal all mines (for game over).
  function revealAllMines(board) {
    const out = [];
    for (const row of board)
      for (const cell of row) {
        if (cell.mine && !cell.revealed && !cell.flagged) {
          cell.revealed = true;
          out.push({ r: cell.r, c: cell.c });
        }
      }
    return out;
  }

  // simple "could have known safe" detector — cells adjacent to a satisfied
  // number cell that aren't yet revealed and aren't mines. Used for post-loss
  // probability-thinking mode.
  function deducibleSafe(board) {
    const rows = board.length, cols = board[0].length;
    const safeSet = new Set();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (!cell.revealed || cell.adj === 0) continue;
      let flags = 0;
      const closed = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const n = board[nr][nc];
          if (n.flagged) flags++;
          else if (!n.revealed) closed.push(n);
        }
      if (flags === cell.adj) {
        for (const n of closed) if (!n.mine) safeSet.add(n.r * cols + n.c);
      }
    }
    return [...safeSet].map(k => ({ r: Math.floor(k / cols), c: k % cols }));
  }

  return { DIFFS, emptyBoard, plant, reveal, chord, flag, isWin, countFlags, revealAllMines, deducibleSafe, rng };
})();

window.MinesEngine = Engine;
