"use client";

import type { HourlyBucket } from "@/lib/stats/compute";

// 24-hour strip showing local-time activity + win rate. Cell hue runs cool→
// gold as win rate climbs; cell opacity scales with sample size so empty
// hours look quiet rather than miscoloured.
export function TimeOfDayStrip({
  buckets,
  bestHour,
}: {
  buckets: HourlyBucket[];
  bestHour: HourlyBucket | null;
}) {
  const maxGames = Math.max(...buckets.map((b) => b.games), 1);
  const totalGames = buckets.reduce((a, b) => a + b.games, 0);
  if (totalGames === 0) {
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
        no games played yet.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(24, 1fr)",
          gap: 2,
        }}
      >
        {buckets.map((b) => (
          <HourCell key={b.hour} bucket={b} maxGames={maxGames} highlight={bestHour?.hour === b.hour} />
        ))}
      </div>
      <div
        className="mono"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          letterSpacing: "0.16em",
          color: "var(--ink-mute)",
        }}
      >
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      {bestHour && bestHour.games >= 3 && (
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-2)",
            marginTop: 4,
          }}
        >
          peak hour:{" "}
          <span style={{ color: "var(--gold)" }}>
            {String(bestHour.hour).padStart(2, "0")}:00 –{" "}
            {String((bestHour.hour + 1) % 24).padStart(2, "0")}:00
          </span>{" "}
          · {Math.round(bestHour.winRate * 100)}% win rate over {bestHour.games}{" "}
          games
        </div>
      )}
    </div>
  );
}

function HourCell({
  bucket,
  maxGames,
  highlight,
}: {
  bucket: HourlyBucket;
  maxGames: number;
  highlight: boolean;
}) {
  if (bucket.games === 0) {
    return (
      <div
        title={`${formatHour(bucket.hour)} · no games`}
        style={{
          height: 24,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 3,
        }}
      />
    );
  }
  // Hue interpolation: red (low) → green (mid) → gold (high)
  const w = bucket.winRate;
  let color = "#ff6b6b";
  if (w >= 0.6) color = "#e3b248";
  else if (w >= 0.4) color = "#4caf6a";
  else if (w >= 0.2) color = "#c0904a";
  // Opacity by sample size (min 0.35 so the colour is still readable)
  const opacity = 0.35 + 0.65 * (bucket.games / maxGames);
  return (
    <div
      title={`${formatHour(bucket.hour)} · ${bucket.wins}/${bucket.games} · ${Math.round(
        bucket.winRate * 100,
      )}%`}
      style={{
        height: 24,
        background: color,
        opacity,
        borderRadius: 3,
        boxShadow: highlight ? "0 0 0 1px var(--gold), 0 0 8px rgba(227,178,72,0.6)" : "none",
      }}
    />
  );
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}
