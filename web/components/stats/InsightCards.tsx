"use client";

import type { Insight } from "@/lib/stats/insights";

export function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
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
        not enough games to call any patterns yet — play 10–20 more and we&apos;ll
        start seeing them.
      </div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
      }}
    >
      {insights.map((i) => (
        <Card key={i.id} insight={i} />
      ))}
    </div>
  );
}

function Card({ insight }: { insight: Insight }) {
  const accent = toneColors(insight.tone);
  return (
    <div
      className="panel"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderColor: accent.border,
        background: accent.bg,
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: accent.kicker,
        }}
      >
        {toneLabel(insight.tone)}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 800,
          color: accent.title,
          lineHeight: 1.1,
        }}
      >
        {insight.title}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--ink-2)",
        }}
      >
        {insight.body}
      </div>
    </div>
  );
}

function toneLabel(t: Insight["tone"]): string {
  if (t === "good") return "★ strength";
  if (t === "warn") return "△ weak spot";
  return "◇ pattern";
}

function toneColors(t: Insight["tone"]): {
  border: string;
  bg: string;
  kicker: string;
  title: string;
} {
  if (t === "good") {
    return {
      border: "var(--gold-deep)",
      bg: "rgba(227,178,72,0.06)",
      kicker: "var(--gold)",
      title: "var(--gold)",
    };
  }
  if (t === "warn") {
    return {
      border: "var(--red-deep, #6a1a1a)",
      bg: "rgba(214,59,59,0.07)",
      kicker: "var(--red-glow, #ff8a8a)",
      title: "var(--red-glow, #ff8a8a)",
    };
  }
  return {
    border: "var(--line)",
    bg: "rgba(0,0,0,0.25)",
    kicker: "var(--ink-mute)",
    title: "var(--ink)",
  };
}
