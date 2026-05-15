"use client";

import { NUM_COLORS } from "@/game/config";

// Tiny self-contained diagrams that illustrate each named coach pattern —
// modeled on the cheat-sheet style of minesweeper.online/help/patterns.
//
// Each diagram is a small grid of "mini cells" that mirror the live demo
// board's color language: gold-ish for closed, dark for revealed numbers,
// green for "safe" deductions, red for "mine" deductions, near-black for
// walls/outside. The point is for the player to recognize the shape on the
// board within a second of opening the strip.

type DiagramCell =
  | { kind: "number"; value: number }
  | { kind: "wall" }
  | { kind: "closed" }
  | { kind: "safe" }
  | { kind: "mine" }
  | { kind: "flag" }
  | { kind: "any" };   // doesn't matter — rendered as faint background

const W: DiagramCell = { kind: "wall" };
const C: DiagramCell = { kind: "closed" };
const S: DiagramCell = { kind: "safe" };
const M: DiagramCell = { kind: "mine" };
const F: DiagramCell = { kind: "flag" };
const A: DiagramCell = { kind: "any" };
const num = (v: number): DiagramCell => ({ kind: "number", value: v });

interface DiagramSpec {
  rows: number;
  cols: number;
  cells: DiagramCell[];
}

// Hardcoded diagrams keyed by pattern name. Trivial rules get parameterized
// by their value (we substitute the number into a template at render time).
const NAMED_DIAGRAMS: Record<string, DiagramSpec> = {
  "1-2-1": {
    rows: 3,
    cols: 5,
    cells: [
      W, W, W, W, W,
      W, num(1), num(2), num(1), W,
      W, M, S, M, W,
    ],
  },
  "1-2-2-1": {
    rows: 3,
    cols: 6,
    cells: [
      W, W, W, W, W, W,
      W, num(1), num(2), num(2), num(1), W,
      W, S, M, M, S, W,
    ],
  },
  "1-1 along wall": {
    rows: 3,
    cols: 5,
    cells: [
      W, W, W, W, W,
      W, num(1), num(1), S, W,
      W, C, C, S, W,
    ],
  },
};

// Build a diagram for a trivial deduction at the requested value. Each value
// gets a square showing the anchor number flanked by closed cells with the
// derived markings.
function buildTrivialDiagram(
  kind: "satisfied" | "locked",
  value: number,
): DiagramSpec {
  // Use a 3x3 grid: anchor in centre, surroundings show known mines + the
  // remaining closed cells with their deduction.
  if (kind === "satisfied") {
    // Show value=N number with N flags + at least one closed deduced safe.
    // Keep things schematic for any N from 1..4 by re-using a slot grid.
    if (value === 1) {
      return {
        rows: 3,
        cols: 3,
        cells: [W, F, W, W, num(1), S, W, S, S],
      };
    }
    if (value === 2) {
      return {
        rows: 3,
        cols: 3,
        cells: [F, W, F, W, num(2), S, W, S, S],
      };
    }
    return {
      rows: 3,
      cols: 3,
      cells: [F, F, F, W, num(value), S, W, S, S],
    };
  }
  // Locked: value=N number whose remaining closed neighbours are all mines.
  if (value === 1) {
    return {
      rows: 3,
      cols: 3,
      cells: [W, W, W, W, num(1), M, W, W, W],
    };
  }
  if (value === 2) {
    return {
      rows: 3,
      cols: 3,
      cells: [W, W, W, W, num(2), M, W, M, W],
    };
  }
  return {
    rows: 3,
    cols: 3,
    cells: [W, M, W, W, num(value), M, W, M, W],
  };
}

export function PatternDiagram({
  patternId,
  patternName,
  cellSize = 18,
}: {
  patternId: string;
  patternName: string;
  cellSize?: number;
}) {
  const spec = pickDiagram(patternId, patternName);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${spec.cols}, ${cellSize}px)`,
        gridAutoRows: `${cellSize}px`,
        gap: 2,
        padding: 4,
        background: "#0a0d10",
        border: "1px solid rgba(227,178,72,0.4)",
        borderRadius: 6,
        width: "fit-content",
      }}
      aria-label={`Diagram of ${patternName}`}
    >
      {spec.cells.map((cell, i) => (
        <MiniCell key={i} cell={cell} size={cellSize} />
      ))}
    </div>
  );
}

function pickDiagram(patternId: string, patternName: string): DiagramSpec {
  // Named patterns — direct lookup.
  if (NAMED_DIAGRAMS[patternName]) return NAMED_DIAGRAMS[patternName];
  // Trivial rules — parse the value from `satisfied N` / `locked N`.
  if (patternId.startsWith("sat-")) {
    const val = parseInt(patternName.split(" ").pop() ?? "1", 10);
    return buildTrivialDiagram("satisfied", isFinite(val) ? val : 1);
  }
  if (patternId.startsWith("lock-")) {
    const val = parseInt(patternName.split(" ").pop() ?? "1", 10);
    return buildTrivialDiagram("locked", isFinite(val) ? val : 1);
  }
  // Fallback: empty 3x3 of walls so the strip still has *something* to show.
  return {
    rows: 3,
    cols: 3,
    cells: Array.from({ length: 9 }, () => W),
  };
}

function MiniCell({ cell, size }: { cell: DiagramCell; size: number }) {
  switch (cell.kind) {
    case "wall":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 2,
            background: "rgba(255,255,255,0.04)",
          }}
        />
      );
    case "any":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        />
      );
    case "closed":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 3,
            background: "linear-gradient(180deg, #d6c69a, #c2b079)",
            boxShadow: "inset 0 1px 0 #f0e2b8, inset 0 -1.5px 0 #8c7943",
          }}
        />
      );
    case "number":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 3,
            background: "linear-gradient(180deg, #1a1f25, #232b33)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            color: NUM_COLORS[cell.value] ?? "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: Math.round(size * 0.7),
            lineHeight: 1,
          }}
        >
          {cell.value}
        </div>
      );
    case "safe":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 3,
            background: "linear-gradient(180deg, #6dd58c, #2f9152)",
            boxShadow:
              "inset 0 1px 0 rgba(220,255,220,0.6), 0 0 6px rgba(76,175,106,0.5)",
            display: "grid",
            placeItems: "center",
            color: "#fff7e4",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: Math.round(size * 0.7),
            lineHeight: 1,
            textShadow: "0 1px 0 rgba(0,40,0,0.55)",
          }}
        >
          ✓
        </div>
      );
    case "mine":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 3,
            background: "linear-gradient(180deg, #ff7a7a, #c43030)",
            boxShadow:
              "inset 0 1px 0 rgba(255,220,220,0.6), 0 0 6px rgba(255,90,90,0.5)",
            display: "grid",
            placeItems: "center",
            color: "#fff7e4",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: Math.round(size * 0.75),
            lineHeight: 1,
            textShadow: "0 1px 0 rgba(60,0,0,0.7)",
          }}
        >
          ✕
        </div>
      );
    case "flag":
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 3,
            background: "linear-gradient(180deg, #d6c69a, #c2b079)",
            boxShadow: "inset 0 1px 0 #f0e2b8, inset 0 -1.5px 0 #8c7943",
            display: "grid",
            placeItems: "center",
            color: "#ff5a5a",
            fontWeight: 900,
            fontSize: Math.round(size * 0.7),
            lineHeight: 1,
          }}
        >
          ⚑
        </div>
      );
  }
}
