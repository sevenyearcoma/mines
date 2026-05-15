"use client";

import type { DecisionSpeedBuckets } from "@/lib/stats/compute";

const BUCKETS: {
  key: keyof DecisionSpeedBuckets;
  label: string;
  hint: string;
  color: string;
}[] = [
  { key: "instant", label: "instant", hint: "< 0.25s", color: "#5fdada" },
  { key: "fast", label: "fast", hint: "< 0.5s", color: "#4caf6a" },
  { key: "normal", label: "normal", hint: "< 1s", color: "#e3b248" },
  { key: "slow", label: "slow", hint: "< 2s", color: "#c97aff" },
  { key: "hesitant", label: "hesitant", hint: "< 4s", color: "#ff8a6a" },
  { key: "frozen", label: "frozen", hint: "≥ 4s", color: "#ff5a5a" },
];

export function DecisionSpeedBars({
  buckets,
  total,
  medianMs,
}: {
  buckets: DecisionSpeedBuckets;
  total: number;
  medianMs: number | null;
}) {
  if (total === 0) {
    return (
      <div
        className="mono"
        style={{
          padding: 18,
          background: "rgba(0,0,0,0.25)",
          border: "1px dashed var(--line-soft)",
          borderRadius: 8,
          fontSize: 11,
          color: "var(--ink-mute)",
          textAlign: "center",
        }}
      >
        no action logs recorded yet — play a few games with the new build.
      </div>
    );
  }
  const max = Math.max(...BUCKETS.map((b) => buckets[b.key]), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-2)",
          letterSpacing: "0.04em",
        }}
      >
        {total} moves analyzed
        {medianMs !== null && (
          <>
            {" · "}
            <span style={{ color: "var(--gold)" }}>
              median {Math.round(medianMs)}ms
            </span>
          </>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {BUCKETS.map((b) => {
          const n = buckets[b.key];
          const pct = Math.round((n / total) * 100);
          const width = (n / max) * 100;
          return (
            <div
              key={b.key}
              style={{ display: "grid", gridTemplateColumns: "100px 1fr 56px", alignItems: "center", gap: 10 }}
            >
              <div
                className="mono upper"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  color: "var(--ink-2)",
                }}
              >
                {b.label}
                <span
                  style={{
                    color: "var(--ink-mute)",
                    marginLeft: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  {b.hint}
                </span>
              </div>
              <div
                style={{
                  height: 12,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${width}%`,
                    background: b.color,
                    boxShadow: `0 0 8px ${b.color}55`,
                    transition: "width 280ms ease",
                  }}
                />
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                {pct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
