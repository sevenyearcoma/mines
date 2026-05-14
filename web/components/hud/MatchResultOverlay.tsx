"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { RoundResult } from "@/lib/engine";
import type { MatchSnapshot } from "@/lib/store/match";
import type { RoundEndPayload } from "@/lib/multiplayer/protocol";
import { fmtTime } from "@/lib/format";
import { capture } from "@/lib/analytics/posthog";
import { HudReadout } from "../primitives/HudReadout";
import { Ornament } from "../primitives/Ornament";

const MATCH_ROUNDS = 5;

export function MatchResultOverlay({
  roundEnd,
  snapshot,
  matchComplete,
  onFindAnother,
  onLeave,
}: {
  roundEnd: RoundEndPayload | null;
  snapshot: MatchSnapshot | null;
  matchComplete: boolean;
  onFindAnother: () => void;
  onLeave: () => void;
}) {
  // Show overlay during between-rounds (round just ended) OR at match end.
  // Match-complete-without-roundEnd is a forfeit before the first round
  // ever finished — also worth showing.
  const visible = (roundEnd !== null || matchComplete) && snapshot !== null;

  useEffect(() => {
    if (!snapshot || !roundEnd) return;
    const youWon = roundEnd.winner === snapshot.youAre;
    capture("match_round_completed", {
      round_index: roundEnd.roundIndex,
      you_won: youWon,
      your_reason: roundEnd.yourResult.reason,
      your_score_total: roundEnd.yourResult.score.total,
      your_score_base: roundEnd.yourResult.score.base,
      your_score_combo: roundEnd.yourResult.score.combo,
      your_score_speed: roundEnd.yourResult.score.speed,
      your_peak_multiplier: roundEnd.yourResult.score.peakMultiplier,
      your_peak_speed_multiplier: roundEnd.yourResult.score.peakSpeedMultiplier,
      your_peak_accuracy_multiplier:
        roundEnd.yourResult.score.peakAccuracyMultiplier,
      your_mistakes: roundEnd.yourResult.score.mistakes,
      your_elapsed_ms: roundEnd.yourResult.elapsedMs,
      your_opens: roundEnd.yourResult.opens,
      opponent_reason: roundEnd.opponentResult.reason,
      opponent_score_total: roundEnd.opponentResult.score.total,
    });
  }, [roundEnd, snapshot]);

  useEffect(() => {
    if (!snapshot || !matchComplete) return;
    const youWon = snapshot.winner === snapshot.youAre;
    capture("match_completed", {
      you_won: youWon,
      your_rounds_won: snapshot.roundsWon[snapshot.youAre],
      opponent_rounds_won: snapshot.roundsWon[1 - snapshot.youAre],
      end_reason: snapshot.endReason,
      opponent_name: snapshot.players[1 - snapshot.youAre].name,
    });
  }, [matchComplete, snapshot]);

  if (!snapshot) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,.55), rgba(0,0,0,.85))",
            backdropFilter: "blur(2px)",
            zIndex: 50,
            pointerEvents: "auto",
          }}
        >
          <motion.div
            initial={{ y: 12, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 6, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className={
              matchComplete && snapshot.winner === snapshot.youAre
                ? "panel panel-gold"
                : "panel"
            }
            style={{
              width: 640,
              padding: 28,
              textAlign: "center",
            }}
          >
            {matchComplete ? (
              <MatchCompleteHeader snapshot={snapshot} />
            ) : (
              <RoundEndHeader roundEnd={roundEnd!} snapshot={snapshot} />
            )}

            {roundEnd && (
              <TwoColumnBreakdown
                roundEnd={roundEnd}
                snapshot={snapshot}
              />
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                marginTop: 22,
                flexWrap: "wrap",
              }}
            >
              {matchComplete ? (
                <>
                  <button
                    className="btn btn-gold sparkle"
                    onClick={onFindAnother}
                  >
                    ▸ find another
                  </button>
                  <button className="btn btn-ghost" onClick={onLeave}>
                    leave
                  </button>
                </>
              ) : (
                <div
                  className="mono upper"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: "var(--ink-mute)",
                  }}
                >
                  next round in a moment…
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RoundEndHeader({
  roundEnd,
  snapshot,
}: {
  roundEnd: RoundEndPayload;
  snapshot: MatchSnapshot;
}) {
  const youWon = roundEnd.winner === snapshot.youAre;
  const tie = roundEnd.winner === null;
  const label = tie ? "DRAW" : youWon ? "ROUND WIN" : "ROUND LOSS";
  return (
    <>
      <Ornament w={120} color={youWon ? "var(--gold)" : "var(--red)"} />
      <div
        className="mono upper"
        style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8 }}
      >
        round {roundEnd.roundIndex + 1} / {MATCH_ROUNDS}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 52,
          marginTop: 4,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        <span
          className={youWon ? "foil" : ""}
          style={
            !youWon && !tie
              ? {
                  color: "var(--red-glow)",
                  textShadow:
                    "0 0 24px rgba(255,106,106,.6), 0 2px 0 #000",
                }
              : {}
          }
        >
          {label}
        </span>
      </div>
    </>
  );
}

function MatchCompleteHeader({ snapshot }: { snapshot: MatchSnapshot }) {
  const youWon = snapshot.winner === snapshot.youAre;
  const tie = snapshot.winner === null;
  const label = tie ? "DRAW" : youWon ? "VICTORY" : "DEFEAT";
  const forfeit = snapshot.endReason === "forfeit";
  return (
    <>
      <Ornament w={120} color={youWon ? "var(--gold)" : "var(--red)"} />
      <div
        className="mono upper"
        style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8 }}
      >
        match complete{forfeit ? " · forfeit" : ""}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 64,
          marginTop: 4,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        <span className={youWon ? "foil" : ""}>{label}</span>
      </div>
      <div
        className="mono upper"
        style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 6 }}
      >
        {snapshot.players[snapshot.youAre].name}{" "}
        {snapshot.roundsWon[snapshot.youAre]} ·{" "}
        {snapshot.roundsWon[1 - snapshot.youAre]}{" "}
        {snapshot.players[1 - snapshot.youAre].name}
      </div>
    </>
  );
}

function TwoColumnBreakdown({
  roundEnd,
  snapshot,
}: {
  roundEnd: RoundEndPayload;
  snapshot: MatchSnapshot;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: 14,
        margin: "22px 0 4px",
        alignItems: "stretch",
      }}
    >
      <PlayerColumn
        name={snapshot.players[snapshot.youAre].name}
        result={roundEnd.yourResult}
        accent="you"
        won={roundEnd.winner === snapshot.youAre}
      />
      <div
        className="mono upper"
        style={{
          alignSelf: "center",
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "var(--ink-mute)",
        }}
      >
        vs
      </div>
      <PlayerColumn
        name={snapshot.players[1 - snapshot.youAre].name}
        result={roundEnd.opponentResult}
        accent="opp"
        won={roundEnd.winner !== null && roundEnd.winner !== snapshot.youAre}
      />
    </div>
  );
}

function PlayerColumn({
  name,
  result,
  accent,
  won,
}: {
  name: string;
  result: RoundResult;
  accent: "you" | "opp";
  won: boolean;
}) {
  const totalTone = won ? "green" : accent === "you" ? "gold" : "red";
  return (
    <div
      className="panel"
      style={{
        padding: 14,
        background: won ? "rgba(227,178,72,0.06)" : "rgba(0,0,0,0.25)",
        borderColor: won ? "var(--gold-deep)" : undefined,
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--ink-mute)",
          marginBottom: 8,
        }}
      >
        {name} · {reasonLabel(result)}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        <HudReadout label="base" value={result.score.base} tone="gold" />
        <HudReadout
          label="combo"
          value={`+${result.score.combo}`}
          tone={result.score.combo > 0 ? "green" : "gold"}
        />
        <HudReadout
          label="speed"
          value={`+${result.score.speed}`}
          tone={result.score.speed > 0 ? "green" : "red"}
        />
        <HudReadout
          label="peak"
          value={`x${result.score.peakMultiplier.toFixed(2)}`}
          tone={result.score.peakMultiplier >= 2 ? "green" : "gold"}
        />
        <HudReadout
          label="spd/acc"
          value={`${result.score.peakSpeedMultiplier.toFixed(1)}/${result.score.peakAccuracyMultiplier.toFixed(1)}`}
          tone="gold"
        />
        <HudReadout
          label="time"
          value={fmtTime(Math.floor(result.elapsedMs / 1000))}
          tone="gold"
        />
        <HudReadout label="opens" value={result.opens} tone="gold" />
        <HudReadout
          label="hp lost"
          value={result.score.mistakes}
          tone={result.score.mistakes > 0 ? "red" : "green"}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <HudReadout
          label="total"
          value={result.score.total}
          tone={totalTone}
        />
      </div>
    </div>
  );
}

function reasonLabel(r: RoundResult): string {
  if (r.reason === "won") return "cleared";
  if (r.reason === "exploded") return "exploded";
  return "timed out";
}
