"use client";

import type { ComputedStats } from "@/lib/stats/compute";
import { fmtTime } from "@/lib/format";

// Compact strip of stand-out numbers that sits right under the insights —
// the "what changed" stuff a player wants to see at a glance.
export function HeadlineStats({ stats }: { stats: ComputedStats }) {
  const guessRate =
    stats.guessStats.totalReveals > 0
      ? stats.guessStats.guesses / stats.guessStats.totalReveals
      : null;
  const tiles: {
    label: string;
    value: string;
    sub?: string;
    tone?: "gold" | "red" | "green";
    hint?: string;
  }[] = [
    {
      label: "games tracked",
      value: stats.totalGames.toString(),
    },
    {
      label: "win rate",
      value: `${Math.round(stats.winRate * 100)}%`,
      tone: stats.winRate >= 0.5 ? "gold" : stats.winRate >= 0.25 ? "green" : "red",
    },
    {
      label: "median move",
      value:
        stats.medianDecisionMs !== null
          ? `${Math.round(stats.medianDecisionMs)}ms`
          : "—",
      tone: "gold",
    },
    {
      label: "opens / click",
      value:
        stats.avgOpensPerClick !== null
          ? stats.avgOpensPerClick.toFixed(1)
          : "—",
    },
    {
      label: "guess rate",
      value: guessRate !== null ? `${Math.round(guessRate * 100)}%` : "—",
      sub:
        stats.guessStats.totalReveals > 0
          ? `${stats.guessStats.guesses} / ${stats.guessStats.totalReveals} reveals`
          : undefined,
      // Lower guess rate = more reads from the board, which is the goal.
      tone:
        guessRate === null
          ? undefined
          : guessRate < 0.15
          ? "gold"
          : guessRate < 0.3
          ? "green"
          : "red",
      hint: "Reveals the coach couldn't prove safe — i.e. you went on intuition, not deduction.",
    },
    {
      label: "guess accuracy",
      value:
        stats.guessStats.guesses > 0
          ? `${Math.round(stats.guessStats.guessSuccessRate * 100)}%`
          : "—",
      sub:
        stats.guessStats.guesses > 0
          ? `${stats.guessStats.guesses - stats.guessStats.guessBusts} survived`
          : undefined,
      tone:
        stats.guessStats.guesses < 5
          ? undefined
          : stats.guessStats.guessSuccessRate >= 0.85
          ? "gold"
          : stats.guessStats.guessSuccessRate >= 0.7
          ? "green"
          : "red",
      hint: "Of all your guesses, the share that didn't hit a mine.",
    },
    {
      label: "avg time to boom",
      value:
        stats.avgTimeToFirstBoomMs !== null
          ? fmtTime(Math.floor(stats.avgTimeToFirstBoomMs / 1000))
          : "—",
      tone: "red",
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
      }}
    >
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gold" | "red" | "green";
  hint?: string;
}) {
  const color =
    tone === "gold"
      ? "var(--gold)"
      : tone === "red"
      ? "var(--red-glow, #ff8a8a)"
      : tone === "green"
      ? "var(--green)"
      : "var(--ink)";
  return (
    <div
      className="panel"
      title={hint}
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        className="mono upper"
        style={{ fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.2em" }}
      >
        {label}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 24,
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--ink-mute)",
            letterSpacing: "0.04em",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
