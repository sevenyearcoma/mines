"use client";

import type { GameStats } from "@/game/bridge";
import type { MatchSnapshot } from "@/lib/store/match";
import type { ScoreSnapshot } from "@/lib/multiplayer/protocol";
import { fmtTime, pad } from "@/lib/format";
import { ComboBadge } from "./ComboBadge";
import { HudReadout } from "../primitives/HudReadout";

const MATCH_ROUNDS = 5;

export function MatchHUD({
  stats,
  snapshot,
  opponentLive,
}: {
  stats: GameStats;
  snapshot: MatchSnapshot;
  opponentLive: ScoreSnapshot | null;
}) {
  const you = snapshot.players[snapshot.youAre];
  const opp = snapshot.players[1 - snapshot.youAre];
  const youWins = snapshot.roundsWon[snapshot.youAre];
  const oppWins = snapshot.roundsWon[1 - snapshot.youAre];

  const timeLeftMs = stats.timeLeftMs;
  const secondsLeft =
    timeLeftMs === null ? null : Math.max(0, Math.ceil(timeLeftMs / 1000));
  const lowTime = secondsLeft !== null && secondsLeft <= 30;
  const roundLabel = `Round ${Math.min(snapshot.roundIndex + 1, MATCH_ROUNDS)} / ${MATCH_ROUNDS}`;

  const safeTotal =
    snapshot.baseConfig.rows * snapshot.baseConfig.cols -
    snapshot.baseConfig.mines;
  const youProgress = clamp01(stats.cellsRevealed / Math.max(1, safeTotal));
  const oppProgress = clamp01(
    (opponentLive?.cellsRevealed ?? 0) / Math.max(1, safeTotal),
  );

  const yourScore = stats.score.total;
  const oppScore = opponentLive?.total ?? 0;
  const lead = yourScore - oppScore;

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
      <ScoreSlot
        name={you.name}
        wins={youWins}
        liveScore={yourScore}
        liveMultiplier={stats.liveMultiplier}
        liveStreak={stats.liveStreak}
        progress={youProgress}
        active
      />

      <LeadDelta lead={lead} />

      <ScoreSlot
        name={opp.name}
        wins={oppWins}
        liveScore={oppScore}
        liveMultiplier={opponentLive?.liveMultiplier ?? 1}
        liveStreak={opponentLive?.liveStreak ?? 0}
        progress={oppProgress}
        opponentStatus={opponentLive?.status}
      />

      <div style={{ width: 1, height: 36, background: "var(--line)" }} />

      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--gold)",
          padding: "0 6px",
        }}
      >
        {roundLabel}
      </div>

      <HudReadout
        label="time left"
        value={secondsLeft === null ? "—:—" : fmtTime(secondsLeft)}
        tone={lowTime ? "red" : "gold"}
        minWidth={130}
      />
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
      <HudReadout
        label="mines"
        value={pad(stats.remaining)}
        tone="red"
        minWidth={100}
      />

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: MATCH_ROUNDS }).map((_, i) => (
          <RoundPip
            key={i}
            winner={mapWinner(snapshot.roundWinners[i], snapshot.youAre)}
            idx={i}
            current={snapshot.roundIndex}
          />
        ))}
      </div>
    </div>
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Map "absolute" winner index (0 or 1) → "you/opp" (0 = you, 1 = opp) so
// pips don't flip depending on which seat you're in.
function mapWinner(
  winner: 0 | 1 | null | undefined,
  youAre: 0 | 1,
): "you" | "opp" | null {
  if (winner === null || winner === undefined) return null;
  return winner === youAre ? "you" : "opp";
}

// Score gap between you and opponent. Goes red and pulses when you're behind,
// gold when ahead. Designed to live in the middle of the HUD so the eye
// catches it every time the value flips.
function LeadDelta({ lead }: { lead: number }) {
  const ahead = lead > 0;
  const behind = lead < 0;
  const big = Math.abs(lead) >= 250;
  const color = behind
    ? "var(--red, #ff6b6b)"
    : ahead
    ? "var(--gold)"
    : "var(--ink-mute)";
  const glow = behind
    ? "0 0 18px rgba(255,90,90,0.55)"
    : ahead
    ? "0 0 14px rgba(227,178,72,0.45)"
    : "none";
  const sign = ahead ? "+" : behind ? "−" : "";
  const abs = Math.abs(lead);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "0 10px",
        minWidth: 70,
        animation: behind && big ? "pulseRed 900ms ease-in-out infinite" : "none",
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          color: "var(--ink-mute)",
        }}
      >
        {behind ? "behind" : ahead ? "lead" : "even"}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 22,
          lineHeight: 1,
          fontWeight: 800,
          color,
          textShadow: glow,
          transition: "color 120ms ease, text-shadow 120ms ease",
        }}
      >
        {sign}
        {pad(abs, 4)}
      </div>
      <style jsx>{`
        @keyframes pulseRed {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}

function ScoreSlot({
  name,
  wins,
  liveScore,
  liveMultiplier,
  liveStreak,
  progress,
  active,
  opponentStatus,
}: {
  name: string;
  wins: number;
  liveScore: number;
  liveMultiplier: number;
  liveStreak: number;
  progress: number;
  active?: boolean;
  opponentStatus?: ScoreSnapshot["status"];
}) {
  const dim = opponentStatus && opponentStatus !== "playing";
  const combo = liveStreak > 0 && liveMultiplier > 1.001;
  const hot = liveMultiplier >= 2.5;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        padding: "4px 14px 6px",
        border: combo
          ? `1px solid ${hot ? "rgba(255,90,90,0.55)" : "rgba(227,178,72,0.55)"}`
          : "1px solid var(--line)",
        borderRadius: 8,
        background: active ? "rgba(227,178,72,0.06)" : "rgba(0,0,0,0.25)",
        minWidth: 140,
        opacity: dim ? 0.7 : 1,
        boxShadow: combo
          ? hot
            ? "0 0 22px rgba(255,90,90,0.28)"
            : "0 0 18px rgba(227,178,72,0.22)"
          : "none",
        transition: "box-shadow 160ms ease, border-color 160ms ease",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <div
          className="mono upper"
          style={{ fontSize: 9, color: "var(--ink-mute)" }}
        >
          {name}
        </div>
        {combo && (
          <div
            className="mono upper"
            style={{
              fontSize: 9,
              padding: "1px 6px",
              borderRadius: 4,
              background: hot ? "var(--red, #ff6b6b)" : "var(--gold)",
              color: "#1a1208",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            ×{liveMultiplier.toFixed(2)}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          className="disp"
          style={{
            fontSize: 28,
            lineHeight: 1,
            color: active ? "var(--gold)" : "var(--ink-2)",
            fontWeight: 800,
          }}
        >
          {wins}
        </div>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--ink-mute)",
          textAlign: "center",
          marginTop: 2,
        }}
      >
        {opponentStatus && opponentStatus !== "playing"
          ? statusLabel(opponentStatus)
          : `${pad(liveScore, 4)}`}
      </div>
      <ProgressBar value={progress} accent={active ? "gold" : "red"} />
    </div>
  );
}

function ProgressBar({
  value,
  accent,
}: {
  value: number;
  accent: "gold" | "red";
}) {
  const pct = Math.round(value * 100);
  const color = accent === "gold" ? "var(--gold)" : "var(--red, #d35454)";
  return (
    <div
      title={`${pct}% cleared`}
      style={{
        marginTop: 6,
        height: 4,
        borderRadius: 3,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          transition: "width 220ms ease",
          boxShadow: `0 0 8px ${
            accent === "gold" ? "rgba(227,178,72,0.5)" : "rgba(211,84,84,0.55)"
          }`,
        }}
      />
    </div>
  );
}

function statusLabel(s: ScoreSnapshot["status"]): string {
  if (s === "finished") return "finished";
  if (s === "exploded") return "exploded";
  if (s === "timeout") return "timed out";
  return "";
}

function RoundPip({
  winner,
  idx,
  current,
}: {
  winner: "you" | "opp" | null;
  idx: number;
  current: number;
}) {
  const isCurrent = idx === current;
  let bg = "rgba(255,255,255,0.06)";
  let border = "var(--line)";
  if (winner === "you") {
    bg = "var(--gold)";
    border = "var(--gold-deep)";
  } else if (winner === "opp") {
    bg = "var(--red, #c0392b)";
    border = "var(--red-deep, #7a1f15)";
  }
  return (
    <div
      title={`Round ${idx + 1}${
        winner === null ? "" : winner === "you" ? " · you" : " · opp"
      }`}
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: isCurrent ? "0 0 0 2px rgba(227,178,72,0.35)" : "none",
      }}
    />
  );
}
