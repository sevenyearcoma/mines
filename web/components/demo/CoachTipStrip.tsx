"use client";

import type { PatternMatch } from "@/lib/coach/types";
import { PatternDiagram } from "./PatternDiagram";

// Inline strip that sits right under the demo board: shows ONE pattern at a
// time — the diagram on the left, name + explanation on the right. By
// default the "primary" detected pattern is shown; hovering a row in the
// side panel swaps the strip.
export function CoachTipStrip({
  pattern,
  patternCount,
}: {
  pattern: PatternMatch | null;
  // How many additional matches of the same pattern exist on the board.
  patternCount: number;
}) {
  if (!pattern) {
    return (
      <div
        className="mono"
        style={{
          width: "100%",
          maxWidth: 720,
          padding: "12px 16px",
          background: "rgba(0,0,0,0.25)",
          border: "1px dashed var(--line-soft)",
          borderRadius: 8,
          fontSize: 11,
          color: "var(--ink-mute)",
          textAlign: "center",
          letterSpacing: "0.04em",
        }}
      >
        coach is watching — no provable deductions on the current frame.
      </div>
    );
  }
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 720,
        display: "flex",
        gap: 14,
        padding: "10px 14px",
        background: "rgba(0,0,0,0.4)",
        border: "1px solid var(--gold-deep)",
        borderRadius: 8,
        boxShadow: "0 0 16px rgba(227,178,72,0.18) inset",
        alignItems: "center",
      }}
    >
      <PatternDiagram
        patternId={pattern.id}
        patternName={pattern.name}
        cellSize={20}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            className="disp"
            style={{
              fontSize: 18,
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--gold)",
              letterSpacing: "0.02em",
            }}
          >
            {pattern.name}
          </span>
          {patternCount > 1 && (
            <span
              className="mono upper"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "var(--ink-mute)",
                border: "1px solid var(--line-soft)",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              ×{patternCount} on board
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ink-2)",
            marginTop: 4,
          }}
        >
          {pattern.explanation}
        </div>
      </div>
    </div>
  );
}
