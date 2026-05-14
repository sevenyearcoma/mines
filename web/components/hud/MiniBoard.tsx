"use client";

import { useMemo } from "react";
import type { BoardSnapshot } from "@/game/bridge";

const NUM_COLORS: Record<number, string> = {
  1: "#3da9ff",
  2: "#2faa6a",
  3: "#ff6b6b",
  4: "#7a52d4",
  5: "#b15c2c",
  6: "#1dbfb4",
  7: "#9aa0a6",
  8: "#d4cfc7",
};

// Frozen snapshot of *your own* board at the moment your run ended. Sits in
// the side panel while you spectate your opponent's main board.
export function MiniBoard({
  snapshot,
  label,
}: {
  snapshot: BoardSnapshot;
  label?: string;
}) {
  const { rows, cols, cells, boom } = snapshot;
  const cellPx = useMemo(() => {
    // Fit comfortably in a ~260px panel: 16-wide → 13px tiles, 8-wide → 22px.
    return Math.max(8, Math.floor(220 / Math.max(rows, cols)));
  }, [rows, cols]);

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "fit-content",
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 9,
          color: "var(--ink-mute)",
          letterSpacing: "0.18em",
        }}
      >
        {label ?? "your last run"}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
          gridAutoRows: `${cellPx}px`,
          gap: 1,
          padding: 3,
          background: "#0a0d11",
          borderRadius: 4,
        }}
      >
        {Array.from(cells).map((v, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const isBoom = boom?.r === r && boom?.c === c;
          return (
            <MiniCell
              key={i}
              v={v}
              size={cellPx}
              isBoom={isBoom}
            />
          );
        })}
      </div>
    </div>
  );
}

function MiniCell({
  v,
  size,
  isBoom,
}: {
  v: number;
  size: number;
  isBoom: boolean;
}) {
  // -1 covered, -2 flagged, -3 mine, else adj 0-8.
  let bg = "#1a2026";
  let text = "";
  let color = "transparent";
  if (v === -1) {
    bg = "#293038";
  } else if (v === -2) {
    bg = "#3a2622";
    text = "⚑";
    color = "#ff8a8a";
  } else if (v === -3) {
    bg = isBoom ? "#ff5a3c" : "#3a0a0a";
    text = "✸";
    color = isBoom ? "#1a0700" : "#ff8a8a";
  } else if (v === 0) {
    bg = "#101418";
  } else if (v > 0) {
    bg = "#101418";
    text = String(v);
    color = NUM_COLORS[v] ?? "#fff";
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        color,
        display: "grid",
        placeItems: "center",
        fontSize: Math.max(7, Math.floor(size * 0.6)),
        fontWeight: 800,
        lineHeight: 1,
        boxShadow: isBoom ? "0 0 6px rgba(255,90,90,0.7)" : "none",
        borderRadius: 1,
      }}
    >
      {text}
    </div>
  );
}
