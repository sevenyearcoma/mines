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
    <>
      <div
        className="play-hud"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          padding: "18px 28px",
          borderBottom: "1.5px solid var(--line)",
          background: "linear-gradient(180deg, var(--panel), transparent)",
          // Defensive stacking — keep the HUD above any sibling that might
          // accidentally paint over the buttons during scroll or layout shift.
          position: "relative",
          zIndex: 3,
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

        <div className="play-hud-spacer" style={{ flex: 1 }} />

        <ComboBadge
          className="play-hud-combo"
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

        {/* Desktop-only inline controls. On mobile, the difficulty tabs and
            new-button live in their own row below the HUD (see .play-difficulty-row). */}
        <div
          className="play-hud-desktop-controls"
          style={{ display: "flex", alignItems: "center", gap: 14 }}
        >
          <div
            className="play-hud-divider"
            style={{ width: 1, height: 36, background: "var(--line)" }}
          />
          <DifficultyTabs activeDifficulty={stats.difficulty} />
          <NewBoardButton />
        </div>
      </div>

      {/* Mobile-only row: dedicated home for the difficulty tabs + new button.
          Lives outside the wrap-flex HUD because iOS Safari has flex-wrap +
          order rendering quirks that left these buttons unreachable. */}
      <div className="play-difficulty-row" aria-label="Difficulty controls">
        <DifficultyTabs activeDifficulty={stats.difficulty} />
        <NewBoardButton />
      </div>
    </>
  );
}

// Tap-friendly button props shared by every control in the mobile row.
// `touchAction: manipulation` kills the iOS 300ms double-tap delay.
// `WebkitTapHighlightColor` makes the tap *visible* on iOS even when
// the resulting state change is subtle.
const TOUCH_PROPS = {
  type: "button" as const,
  style: {
    touchAction: "manipulation" as const,
    WebkitTapHighlightColor: "rgba(227,178,72,0.4)",
    WebkitUserSelect: "none" as const,
    userSelect: "none" as const,
  },
};

function DifficultyTabs({ activeDifficulty }: { activeDifficulty: Difficulty }) {
  return (
    <div
      className="play-difficulty-tabs"
      style={{
        display: "flex",
        gap: 2,
        padding: 3,
        background: "rgba(0,0,0,.4)",
        border: "1px solid var(--line-soft)",
        borderRadius: 6,
      }}
    >
      {(Object.keys(DIFFS) as Difficulty[]).map((k) => {
        const active = activeDifficulty === k;
        return (
          <button
            key={k}
            {...TOUCH_PROPS}
            onClick={() => bridge.emit("solo:difficultyRequested", k)}
            className="mono upper play-difficulty-btn"
            aria-pressed={active}
            style={{
              ...TOUCH_PROPS.style,
              fontSize: 10,
              letterSpacing: "0.16em",
              padding: "6px 10px",
              background: active
                ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
                : "rgba(0,0,0,0.25)",
              color: active ? "#2a1d04" : "var(--ink-2)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: active ? "0 1px 0 rgba(0,0,0,.4)" : "none",
            }}
          >
            {k.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

function NewBoardButton() {
  return (
    <button
      {...TOUCH_PROPS}
      className="btn btn-ghost play-new-button"
      onClick={() => bridge.emit("cmd:reset")}
      style={{ ...TOUCH_PROPS.style, padding: "10px 14px", fontSize: 14 }}
    >
      ↻ new
    </button>
  );
}
