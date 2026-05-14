"use client";

import { DIFFS, type Difficulty } from "@/lib/engine";
import { bridge, type GameStats } from "@/game/bridge";
import { fmtTime, pad } from "@/lib/format";
import { ComboBadge } from "./ComboBadge";
import { HudReadout } from "../primitives/HudReadout";

export function TopHUD({ stats }: { stats: GameStats }) {
  const seconds = Math.floor(stats.elapsedMs / 1000);
  const timeLow = seconds > 60;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 28px",
        borderBottom: "1.5px solid var(--line)",
        background: "linear-gradient(180deg, var(--panel), transparent)",
      }}
    >
      <HudReadout label="mines" value={pad(stats.remaining)} tone="red" minWidth={130} />
      <HudReadout
        label="time"
        value={fmtTime(seconds)}
        tone={timeLow ? "red" : "gold"}
        minWidth={150}
      />
      <HudReadout label="opens" value={pad(stats.opens)} tone="gold" minWidth={110} />

      <div style={{ flex: 1 }} />

      <ComboBadge
        multiplier={stats.liveMultiplier}
        speedMultiplier={stats.liveSpeedMultiplier}
        accuracyMultiplier={stats.liveAccuracyMultiplier}
        streak={stats.liveStreak}
        accuracyStreak={stats.accuracyStreak}
        lives={stats.lives}
        maxLives={stats.maxLives}
        stunRemainingMs={stats.stunRemainingMs}
        minWidth={190}
      />

      <div style={{ width: 1, height: 36, background: "var(--line)" }} />

      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 3,
          background: "rgba(0,0,0,.4)",
          border: "1px solid var(--line-soft)",
          borderRadius: 6,
        }}
      >
        {(Object.keys(DIFFS) as Difficulty[]).map((k) => (
          <button
            key={k}
            onClick={() => bridge.emit("cmd:setDifficulty", k)}
            className="mono upper"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              padding: "6px 10px",
              background:
                stats.difficulty === k
                  ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
                  : "transparent",
              color: stats.difficulty === k ? "#2a1d04" : "var(--ink-2)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: stats.difficulty === k ? "0 1px 0 rgba(0,0,0,.4)" : "none",
            }}
          >
            {k.slice(0, 3)}
          </button>
        ))}
      </div>

      <button
        className="btn btn-ghost"
        onClick={() => bridge.emit("cmd:reset")}
        style={{ padding: "10px 14px", fontSize: 14 }}
      >
        ↻ new
      </button>
    </div>
  );
}
