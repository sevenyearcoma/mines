"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  DIFFS,
  dailyRoundConfig,
  emptyBoard,
  plant,
  reveal,
  todayUtcDate,
} from "@/lib/engine";

const PREVIEW_SIZE = 10;

type PreviewCell = {
  // matches the home-cell-* class suffixes already in globals.css:
  // h (hidden), r0..r8 (revealed), m (mine), f (flagged)
  key: string;
  label: string;
};

function classifyCell(revealed: boolean, mine: boolean, adj: number): PreviewCell {
  if (!revealed) return { key: "h", label: "" };
  if (mine) return { key: "m", label: "" };
  if (adj === 0) return { key: "r0", label: "" };
  return { key: `r${adj}`, label: String(adj) };
}

// Centre-cropped preview of today's daily challenge. The cells around the
// pre-revealed anchor (the same first reveal everyone sees) are visible; the
// rest of the board stays covered — same as what a player sees when they
// open /daily, just framed.
export function DailyPreviewBoard() {
  const { cells, dateUtc, openCount } = useMemo(() => {
    const dateUtc = todayUtcDate();
    const cfg = dailyRoundConfig(dateUtc);
    const board = emptyBoard(cfg.rows, cfg.cols);
    if (cfg.prePlant) {
      plant(board, cfg.mines, cfg.seed, cfg.prePlant.r, cfg.prePlant.c);
      reveal(board, cfg.prePlant.r, cfg.prePlant.c);
    }

    const anchorR = cfg.prePlant?.r ?? Math.floor(cfg.rows / 2);
    const anchorC = cfg.prePlant?.c ?? Math.floor(cfg.cols / 2);
    const half = Math.floor(PREVIEW_SIZE / 2);
    // Clamp so the crop window can't slide off the board on small layouts.
    const startR = Math.max(0, Math.min(cfg.rows - PREVIEW_SIZE, anchorR - half));
    const startC = Math.max(0, Math.min(cfg.cols - PREVIEW_SIZE, anchorC - half));

    const cells: PreviewCell[] = [];
    for (let r = 0; r < PREVIEW_SIZE; r++) {
      for (let c = 0; c < PREVIEW_SIZE; c++) {
        const cell = board[startR + r][startC + c];
        cells.push(classifyCell(cell.revealed, cell.mine, cell.adj));
      }
    }

    // Total revealed across the whole 16x16 (not just the visible crop) is
    // the player-facing "you start with N safe" number.
    let openCount = 0;
    for (const row of board) for (const cell of row) if (cell.revealed) openCount += 1;

    return { cells, dateUtc, openCount };
  }, []);

  const mines = DIFFS.intermediate.mines;

  return (
    <div className="home-board-stage" aria-label="Daily challenge preview">
      <div className="home-board-top">
        <div>
          <span className="mono">daily · {dateUtc}</span>
          <strong>one life, pure hardcore</strong>
        </div>
        <Link href="/daily" className="home-clock mono" style={{ textDecoration: "none" }}>
          play →
        </Link>
      </div>
      <div className="home-board">
        {cells.map((cell, index) => (
          <span
            className={`home-cell home-cell-${cell.key}`}
            key={`${cell.key}-${index}`}
          >
            {cell.label}
          </span>
        ))}
      </div>
      <div className="home-board-bottom">
        <span className="chip chip-green">{openCount} cells open</span>
        <span className="chip chip-red">{mines} mines waiting</span>
      </div>
    </div>
  );
}
