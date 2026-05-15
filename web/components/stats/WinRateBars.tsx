"use client";

import type { Difficulty } from "@/lib/engine";
import type { DifficultyStats } from "@/lib/stats/compute";
import { fmtTime } from "@/lib/format";

const ORDER: Difficulty[] = ["beginner", "intermediate", "expert"];

export function WinRateBars({
  byDifficulty,
}: {
  byDifficulty: Record<Difficulty, DifficultyStats>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {ORDER.map((d) => (
        <Row key={d} difficulty={d} stats={byDifficulty[d]} />
      ))}
    </div>
  );
}

function Row({
  difficulty,
  stats,
}: {
  difficulty: Difficulty;
  stats: DifficultyStats;
}) {
  const pct = Math.round(stats.winRate * 100);
  const empty = stats.games === 0;
  const accent =
    pct >= 60 ? "var(--gold)" : pct >= 30 ? "var(--green)" : "var(--red, #d35454)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: empty ? "var(--ink-mute)" : "var(--ink)",
          }}
        >
          {difficulty}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "baseline",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--ink-mute)",
              letterSpacing: "0.1em",
            }}
          >
            {stats.games > 0
              ? `${stats.wins}/${stats.games}` +
                (stats.bestWinTimeMs !== null
                  ? ` · best ${fmtTime(Math.floor(stats.bestWinTimeMs / 1000))}`
                  : "")
              : "—"}
          </span>
          <span
            className="disp"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: empty ? "var(--ink-mute)" : accent,
              minWidth: 56,
              textAlign: "right",
            }}
          >
            {empty ? "—" : `${pct}%`}
          </span>
        </div>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${empty ? 0 : pct}%`,
            height: "100%",
            background: empty
              ? "transparent"
              : `linear-gradient(90deg, ${accent}, ${accent})`,
            boxShadow: empty
              ? "none"
              : `0 0 10px ${
                  pct >= 60
                    ? "rgba(227,178,72,0.4)"
                    : "rgba(255,107,107,0.35)"
                }`,
            transition: "width 280ms ease",
          }}
        />
      </div>
    </div>
  );
}
