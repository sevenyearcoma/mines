import type { BoardRef, PatternMatch } from "./types";
import { buildConstraints } from "./util";

// Trivial rule 1: "Satisfied N"
// If the number's flagged-neighbour count already equals N, every remaining
// closed-unrevealed-unflagged neighbour must be safe.
//
// Trivial rule 2: "Locked N"
// If the number's remaining mine count (N - flagged) equals the number of
// remaining closed neighbours, every one of those neighbours is a mine.
export function detectTrivial(board: BoardRef): PatternMatch[] {
  const matches: PatternMatch[] = [];
  for (const cn of buildConstraints(board)) {
    if (cn.closed.length === 0) continue;
    const remaining = cn.value - cn.flagged.length;
    if (remaining < 0) continue; // over-flagged — board is in error, ignore

    if (remaining === 0) {
      // Satisfied — value mines already accounted for by flags + detonated bombs.
      matches.push({
        id: `sat-${cn.r}-${cn.c}`,
        name: `satisfied ${cn.value}`,
        shortLabel: `sat ${cn.value}`,
        explanation: `This ${cn.value} already touches ${cn.value} known mine${
          cn.value === 1 ? "" : "s"
        } (flags + detonated bombs) — every remaining closed neighbour is safe.`,
        anchors: [{ r: cn.r, c: cn.c }],
        conclusions: cn.closed.map((n) => ({
          kind: "safe" as const,
          r: n.r,
          c: n.c,
        })),
      });
    } else if (remaining === cn.closed.length) {
      // Locked-in — every remaining closed neighbour MUST be a mine.
      matches.push({
        id: `lock-${cn.r}-${cn.c}`,
        name: `locked ${cn.value}`,
        shortLabel: `lock ${cn.value}`,
        explanation:
          cn.flagged.length > 0
            ? `This ${cn.value} needs ${remaining} more mine${
                remaining === 1 ? "" : "s"
              } and has exactly ${remaining} closed neighbour${
                remaining === 1 ? "" : "s"
              } left — they're all mines.`
            : `This ${cn.value} has exactly ${remaining} closed neighbour${
                remaining === 1 ? "" : "s"
              } left — they're all mines.`,
        anchors: [{ r: cn.r, c: cn.c }],
        conclusions: cn.closed.map((n) => ({
          kind: "mine" as const,
          r: n.r,
          c: n.c,
        })),
      });
    }
  }
  return matches;
}
