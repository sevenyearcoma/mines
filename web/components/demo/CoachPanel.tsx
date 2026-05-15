"use client";

import { useMemo } from "react";
import type { CoachReport, PatternMatch } from "@/lib/coach/types";
import { PatternDiagram } from "./PatternDiagram";

// Side panel that lives next to the demo board when the coach is enabled.
// Lists detected patterns grouped by name; hovering a row highlights its
// anchor cells on the board via the onHoverAnchors callback.
export function CoachPanel({
  report,
  hoverPatternId,
  onHoverPattern,
}: {
  report: CoachReport;
  hoverPatternId: string | null;
  onHoverPattern: (id: string | null) => void;
}) {
  const grouped = useMemo(() => groupByName(report.patterns), [report.patterns]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "rgba(0,0,0,0.32)",
        height: "fit-content",
      }}
    >
      <div>
        <div
          className="mono upper"
          style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            color: "var(--ink-mute)",
          }}
        >
          coach
        </div>
        <div
          className="disp"
          style={{
            fontSize: 22,
            fontWeight: 800,
            marginTop: 4,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          deductions
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Pill kind="safe" count={report.safeCount} />
        <Pill kind="mine" count={report.mineCount} />
      </div>

      {report.patterns.length === 0 ? (
        <div
          className="mono"
          style={{
            padding: 12,
            background: "rgba(0,0,0,0.25)",
            border: "1px dashed var(--line-soft)",
            borderRadius: 8,
            fontSize: 11,
            color: "var(--ink-mute)",
            lineHeight: 1.5,
          }}
        >
          no patterns yet — the coach watches for satisfied numbers, locked
          mines, and 1-2-1 / 1-2-2-1 / 1-1-wall shapes as the game unfolds.
        </div>
      ) : (
        <>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              lineHeight: 1.4,
            }}
          >
            hover a pattern to anchor it on the board.
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 360,
              overflow: "auto",
            }}
          >
            {grouped.map((group) => (
              <Group
                key={group.name}
                name={group.name}
                patterns={group.patterns}
                hoverPatternId={hoverPatternId}
                onHoverPattern={onHoverPattern}
              />
            ))}
          </div>
        </>
      )}

      <div
        className="mono upper"
        style={{
          marginTop: 2,
          paddingTop: 8,
          borderTop: "1px solid var(--line-soft)",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--ink-mute)",
          lineHeight: 1.6,
        }}
      >
        ✓ safe · ✕ mine · gold halo = pattern anchor
      </div>
    </div>
  );
}

function Group({
  name,
  patterns,
  hoverPatternId,
  onHoverPattern,
}: {
  name: string;
  patterns: PatternMatch[];
  hoverPatternId: string | null;
  onHoverPattern: (id: string | null) => void;
}) {
  // Group of matches that share the same pattern name. Surface one expanded
  // representative; the rest are condensed by count.
  const head = patterns[0];
  const extra = patterns.length - 1;
  return (
    <div
      onMouseEnter={() => onHoverPattern(head.id)}
      onMouseLeave={() => onHoverPattern(null)}
      style={{
        padding: 10,
        borderRadius: 6,
        background:
          hoverPatternId === head.id
            ? "rgba(227,178,72,0.1)"
            : "rgba(0,0,0,0.22)",
        border:
          hoverPatternId === head.id
            ? "1px solid var(--gold-deep)"
            : "1px solid var(--line-soft)",
        cursor: "pointer",
        transition: "background 100ms ease, border-color 100ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <PatternDiagram patternId={head.id} patternName={head.name} cellSize={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              className="mono upper"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--gold)",
              }}
            >
              {name}
            </div>
            {extra > 0 && (
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--ink-mute)",
                  letterSpacing: "0.1em",
                }}
              >
                ×{patterns.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ kind, count }: { kind: "safe" | "mine"; count: number }) {
  const color = kind === "safe" ? "var(--green)" : "var(--red-glow, #ff8a8a)";
  return (
    <div
      style={{
        flex: 1,
        padding: "8px 10px",
        border: `1px solid ${kind === "safe" ? "var(--green)" : "var(--red-deep)"}`,
        borderRadius: 6,
        background:
          kind === "safe"
            ? "rgba(76,175,106,0.08)"
            : "rgba(214,59,59,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        className="mono upper"
        style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--ink-mute)" }}
      >
        {kind}
      </div>
      <div
        className="disp"
        style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}
      >
        {count}
      </div>
    </div>
  );
}

function groupByName(patterns: PatternMatch[]): {
  name: string;
  patterns: PatternMatch[];
}[] {
  const map = new Map<string, PatternMatch[]>();
  for (const p of patterns) {
    const arr = map.get(p.name) ?? [];
    arr.push(p);
    map.set(p.name, arr);
  }
  // Sort by descending count so the most prominent patterns lead.
  return [...map.entries()]
    .map(([name, patterns]) => ({ name, patterns }))
    .sort((a, b) => b.patterns.length - a.patterns.length);
}
