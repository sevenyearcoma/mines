import type { BoardRef, CoachReport, Conclusion, PatternMatch } from "./types";
import { detect11Wall, detect121, detect1221 } from "./patterns";
import { detectTrivial } from "./trivial";

// Run every detector on the board and de-duplicate conclusions across them.
// Conflicting conclusions (one rule says safe, another says mine) should
// never happen on a legal board state, but if they do the trivial rule wins
// — it's the most direct from numbers, the visual patterns assume tidy
// positioning that may have been violated by flag mistakes.
export function detectCoach(board: BoardRef): CoachReport {
  const patterns: PatternMatch[] = [
    ...detectTrivial(board),
    ...detect121(board),
    ...detect1221(board),
    ...detect11Wall(board),
  ];

  type Key = string;
  const byCell = new Map<Key, Conclusion>();
  const key = (r: number, c: number) => `${r},${c}`;

  for (const p of patterns) {
    for (const conc of p.conclusions) {
      const k = key(conc.r, conc.c);
      const existing = byCell.get(k);
      if (!existing) {
        byCell.set(k, { ...conc, sources: [p.id] });
        continue;
      }
      // Same conclusion — just remember another source.
      if (existing.kind === conc.kind) {
        if (!existing.sources.includes(p.id)) existing.sources.push(p.id);
        continue;
      }
      // Conflict — keep whichever came from a trivial rule (id starts
      // `sat-` or `lock-`). If neither, drop the conclusion entirely.
      const existingIsTrivial = existing.sources.some(
        (id) => id.startsWith("sat-") || id.startsWith("lock-"),
      );
      const incomingIsTrivial = p.id.startsWith("sat-") || p.id.startsWith("lock-");
      if (existingIsTrivial && !incomingIsTrivial) continue;
      if (!existingIsTrivial && incomingIsTrivial) {
        byCell.set(k, { ...conc, sources: [p.id] });
        continue;
      }
      // No tiebreaker → conservative: drop.
      byCell.delete(k);
    }
  }

  const conclusions = [...byCell.values()];
  let safeCount = 0;
  let mineCount = 0;
  for (const c of conclusions) {
    if (c.kind === "safe") safeCount++;
    else mineCount++;
  }
  return { patterns, conclusions, safeCount, mineCount };
}
