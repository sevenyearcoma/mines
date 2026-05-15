"use client";

import { useMemo } from "react";
import type { Board } from "@/lib/engine";
import { NUM_COLORS } from "@/game/config";
import type { CoachReport } from "@/lib/coach/types";

// Stateless renderer for a single Board snapshot. The player drives playback
// by handing in new boards as time advances.
export function DemoBoard({
  board,
  cellSize = 30,
  highlight,
  boomCell,
  coach,
  coachAnchors,
}: {
  board: Board;
  cellSize?: number;
  // Optional cell to outline (e.g. last action's target so the viewer can
  // track what just happened).
  highlight?: { r: number; c: number } | null;
  // Boom cell to render with the "blown up" red glow.
  boomCell?: { r: number; c: number } | null;
  // When the coach is enabled, the report drives green/red overlays on
  // deduced cells. Optional — pass null/undefined to disable.
  coach?: CoachReport | null;
  // Anchor cells (the revealed numbers a hovered pattern points at) get a
  // gold halo so the player can see WHY the deduction holds.
  coachAnchors?: Array<{ r: number; c: number }>;
}) {
  // Build lookup tables once per render — O(rows*cols) is tiny compared to
  // the React diff for a 16×16 grid.
  const conclusionByCell = useMemo(() => {
    const map = new Map<string, "safe" | "mine">();
    if (coach) {
      for (const c of coach.conclusions) map.set(`${c.r},${c.c}`, c.kind);
    }
    return map;
  }, [coach]);
  const anchorSet = useMemo(() => {
    const set = new Set<string>();
    if (coachAnchors) for (const a of coachAnchors) set.add(`${a.r},${a.c}`);
    return set;
  }, [coachAnchors]);

  if (!board.length) return null;
  const rows = board.length;
  const cols = board[0].length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridAutoRows: `${cellSize}px`,
        gap: 2,
        padding: 8,
        background: "#0e1318",
        border: "2px solid #b48127",
        borderRadius: 12,
        boxShadow: "inset 0 0 0 1px rgba(227,178,72,0.3), 0 0 28px rgba(0,0,0,0.6)",
        width: "fit-content",
      }}
    >
      {board.flatMap((row, r) =>
        row.map((cell, c) => {
          const isHighlight = highlight?.r === r && highlight?.c === c;
          const isBoom = boomCell?.r === r && boomCell?.c === c;
          const conclusion = conclusionByCell.get(`${r},${c}`);
          const isAnchor = anchorSet.has(`${r},${c}`);
          return (
            <Tile
              key={`${r}-${c}`}
              revealed={cell.revealed}
              flagged={cell.flagged}
              mine={cell.mine}
              adj={cell.adj}
              size={cellSize}
              highlight={isHighlight}
              boom={isBoom}
              coachMark={conclusion}
              coachAnchor={isAnchor}
            />
          );
        }),
      )}
    </div>
  );
}

function Tile({
  revealed,
  flagged,
  mine,
  adj,
  size,
  highlight,
  boom,
  coachMark,
  coachAnchor,
}: {
  revealed: boolean;
  flagged: boolean;
  mine: boolean;
  adj: number;
  size: number;
  highlight: boolean;
  boom: boolean;
  coachMark?: "safe" | "mine";
  coachAnchor?: boolean;
}) {
  let body: React.ReactNode = null;
  let bg = "linear-gradient(180deg, #d6c69a, #c2b079)";
  let inset = "inset 0 1.5px 0 #f0e2b8, inset 0 -2px 0 #8c7943";

  if (revealed && mine) {
    bg = boom
      ? "radial-gradient(circle at 50% 45%, #ff7a44 0%, #d63b3b 55%, #320909 100%)"
      : "radial-gradient(circle at 50% 45%, #b13a3a 0%, #5a1010 65%, #1a0303 100%)";
    inset = "inset 0 0 0 1px rgba(0,0,0,0.6)";
    body = <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>✸</span>;
  } else if (revealed) {
    bg = "linear-gradient(180deg, #1a1f25, #232b33)";
    inset = "inset 0 2px 4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.55)";
    if (adj > 0) {
      body = (
        <span
          style={{
            color: NUM_COLORS[adj] ?? "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: Math.round(size * 0.62),
            lineHeight: 1,
          }}
        >
          {adj}
        </span>
      );
    }
  } else if (flagged) {
    body = (
      <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>⚑</span>
    );
  }

  // Coach mark on a closed cell wins over the beige tile look — repaint the
  // whole tile so the deduction is unmistakable. On already-rendered tiles
  // (rare: a number gets marked) the corner-badge fallback still applies.
  const coachOverridesTile =
    coachMark && !revealed && !flagged;
  if (coachOverridesTile) {
    if (coachMark === "safe") {
      bg = "linear-gradient(180deg, #6dd58c, #2f9152)";
      inset =
        "inset 0 1.5px 0 rgba(220,255,220,0.7), inset 0 -2px 0 rgba(20,100,40,0.85), 0 0 14px rgba(76,175,106,0.55)";
    } else {
      bg = "linear-gradient(180deg, #ff7a7a, #c43030)";
      inset =
        "inset 0 1.5px 0 rgba(255,220,220,0.75), inset 0 -2px 0 rgba(110,15,15,0.85), 0 0 14px rgba(255,90,90,0.55)";
    }
  }

  // Outline priority: gold highlight (last action) wins over anchor halo
  // because the user explicitly tracks the action under playback.
  let outline = "none";
  let outlineOffset = "0";
  if (highlight) {
    outline = "2px solid var(--gold)";
    outlineOffset = "1px";
  } else if (coachAnchor) {
    outline = "2px solid rgba(227,178,72,0.85)";
    outlineOffset = "1px";
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: bg,
        boxShadow: inset,
        display: "grid",
        placeItems: "center",
        color: flagged ? "#ff6a6a" : boom ? "#fff7c4" : "#1a0a0a",
        outline,
        outlineOffset,
        transition: "outline 80ms ease, background 120ms ease",
        position: "relative",
      }}
    >
      {body}
      {coachMark && (
        <CoachMark
          kind={coachMark}
          size={size}
          asBadge={!coachOverridesTile}
        />
      )}
    </div>
  );
}

function CoachMark({
  kind,
  size,
  asBadge,
}: {
  kind: "safe" | "mine";
  size: number;
  asBadge: boolean;
}) {
  // `asBadge` = small corner pip rendered on top of an existing tile body
  // (revealed cell that also got a deduction). Otherwise we render a big
  // centered glyph that owns the cell.
  if (asBadge) {
    const color = kind === "safe" ? "#4caf6a" : "#ff5a5a";
    const glow =
      kind === "safe"
        ? "0 0 10px rgba(76,175,106,0.55)"
        : "0 0 10px rgba(255,90,90,0.55)";
    return (
      <span
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: "50%",
          background: color,
          boxShadow: glow,
          pointerEvents: "none",
        }}
      />
    );
  }
  // Centered glyph. White-on-color so it pops against the new tile bg.
  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        color: "#fff7e4",
        fontFamily: "var(--font-display)",
        fontWeight: 900,
        fontSize: Math.round(size * (kind === "safe" ? 0.7 : 0.78)),
        lineHeight: 1,
        textShadow:
          kind === "safe"
            ? "0 1px 0 rgba(0,40,0,0.55), 0 0 6px rgba(255,255,255,0.45)"
            : "0 1px 0 rgba(60,0,0,0.7), 0 0 6px rgba(255,255,255,0.45)",
        pointerEvents: "none",
      }}
    >
      {kind === "safe" ? "✓" : "✕"}
    </span>
  );
}
