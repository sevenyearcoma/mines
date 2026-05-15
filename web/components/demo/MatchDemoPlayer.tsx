"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { detectCoach } from "@/lib/coach/detect";
import type { CoachReport, PatternMatch } from "@/lib/coach/types";
import { frameAt, indexForMs, totalMs } from "@/lib/demo/playback";
import type { Demo, MatchDemo } from "@/lib/demo/types";
import { fmtTime } from "@/lib/format";
import { countryName, flagEmoji } from "@/lib/leaderboard/country";
import { type MascotPose } from "@/components/mascot/MinosMascot";
import { useMascotPose } from "@/components/mascot/MascotRail";
import { useProMode } from "@/components/pro/ProProvider";
import { CoachTipStrip } from "./CoachTipStrip";
import { DemoBoard } from "./DemoBoard";

const COACH_STORAGE_KEY = "mines:demo:coach";

// Picks the pattern most relevant to the player's most recent action — anchor
// hit > conclusion hit > nearest by Manhattan distance > first match.
function pickPrimary(
  report: CoachReport | null,
  lastAction: { r: number; c: number } | null,
): PatternMatch | null {
  if (!report || report.patterns.length === 0) return null;
  if (!lastAction) return report.patterns[0];
  const { r: lr, c: lc } = lastAction;

  const anchorHit = report.patterns.find((p) =>
    p.anchors.some((a) => a.r === lr && a.c === lc),
  );
  if (anchorHit) return anchorHit;

  const concHit = report.patterns.find((p) =>
    p.conclusions.some((c) => c.r === lr && c.c === lc),
  );
  if (concHit) return concHit;

  let best = report.patterns[0];
  let bestDist = Infinity;
  for (const p of report.patterns) {
    const dist = p.anchors.reduce((acc, a) => {
      const d = Math.abs(a.r - lr) + Math.abs(a.c - lc);
      return d < acc ? d : acc;
    }, Infinity);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

export function MatchDemoPlayer({ demo }: { demo: MatchDemo }) {
  const { isPro } = useProMode();
  const total = useMemo(
    () => Math.max(totalMs(demo.player0), totalMs(demo.player1)),
    [demo],
  );
  const actionTimes = useMemo(() => {
    const times = [
      ...demo.player0.actions.map((a) => a.atMs),
      ...demo.player1.actions.map((a) => a.atMs),
    ];
    return Array.from(new Set(times)).sort((a, b) => a - b);
  }, [demo]);

  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  // Coach defaults to ON when Pro is enabled; flipping Pro off hard-disables.
  const [coachPref, setCoachPref] = useState<boolean>(true);
  const coachOn = isPro && coachPref;
  const lastTickRef = useRef<number | null>(null);
  const currentMsRef = useRef(currentMs);
  currentMsRef.current = currentMs;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COACH_STORAGE_KEY);
      if (stored === "0") setCoachPref(false);
    } catch {
      // storage disabled — keep default
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(COACH_STORAGE_KEY, coachPref ? "1" : "0");
    } catch {
      // ignore
    }
  }, [coachPref]);

  useEffect(() => {
    if (!playing) {
      lastTickRef.current = null;
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      const last = lastTickRef.current ?? t;
      lastTickRef.current = t;
      const next = currentMsRef.current + (t - last) * speed;
      if (next >= total) {
        setCurrentMs(total);
        setPlaying(false);
        return;
      }
      setCurrentMs(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);

  const onSeek = useCallback(
    (ms: number) => {
      setCurrentMs(Math.max(0, Math.min(total, ms)));
    },
    [total],
  );

  const onTogglePlay = useCallback(() => {
    if (currentMsRef.current >= total) setCurrentMs(0);
    setPlaying((p) => !p);
  }, [total]);

  const stepBy = useCallback(
    (delta: number) => {
      setPlaying(false);
      if (!actionTimes.length) {
        setCurrentMs(delta > 0 ? total : 0);
        return;
      }
      const current = currentMsRef.current;
      if (delta > 0) {
        const next = actionTimes.findIndex((ms) => ms > current + 0.5);
        if (next === -1) {
          setCurrentMs(total);
          return;
        }
        setCurrentMs(actionTimes[Math.min(next + delta - 1, actionTimes.length - 1)]);
        return;
      }

      let previous = -1;
      for (let i = 0; i < actionTimes.length; i++) {
        if (actionTimes[i] < current - 0.5) previous = i;
        else break;
      }
      if (previous === -1) {
        setCurrentMs(0);
        return;
      }
      setCurrentMs(actionTimes[Math.max(previous + delta + 1, 0)]);
    },
    [actionTimes, total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepBy(e.shiftKey ? 10 : 1);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepBy(e.shiftKey ? -10 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTogglePlay, stepBy]);

  const frame0 = useMemo(
    () => frameAt(demo.player0, indexForMs(demo.player0, currentMs)),
    [currentMs, demo.player0],
  );
  const frame1 = useMemo(
    () => frameAt(demo.player1, indexForMs(demo.player1, currentMs)),
    [currentMs, demo.player1],
  );

  const coach0 = useMemo(
    () => (coachOn ? detectCoach(frame0.board) : null),
    [coachOn, frame0.board],
  );
  const coach1 = useMemo(
    () => (coachOn ? detectCoach(frame1.board) : null),
    [coachOn, frame1.board],
  );

  const mascotPose = matchDemoPose(demo, currentMs, total);
  const mascotCaption = matchDemoCaption(demo, currentMs, total);
  useMascotPose(mascotPose, mascotCaption);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1240,
        margin: "0 auto",
        padding: "22px 24px 46px clamp(72px, 9vw, 140px)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div>
        <MatchControls
          currentMs={currentMs}
          totalMs={total}
          playing={playing}
          speed={speed}
          onSeek={onSeek}
          onTogglePlay={onTogglePlay}
          onRestart={() => {
            setPlaying(false);
            setCurrentMs(0);
          }}
          onStep={stepBy}
          onSpeed={setSpeed}
          showCoachToggle={isPro}
          coachOn={coachOn}
          onToggleCoach={() => setCoachPref((v) => !v)}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(520px, 100%), 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <PlayerReplay
          demo={demo.player0}
          frame={frame0}
          playerLabel="player 1"
          won={demo.winner === 0}
          coach={coach0}
        />
        <PlayerReplay
          demo={demo.player1}
          frame={frame1}
          playerLabel="player 2"
          won={demo.winner === 1}
          coach={coach1}
        />
      </div>
    </div>
  );
}

function MatchControls({
  currentMs,
  totalMs,
  playing,
  speed,
  onSeek,
  onTogglePlay,
  onRestart,
  onStep,
  onSpeed,
  showCoachToggle,
  coachOn,
  onToggleCoach,
}: {
  currentMs: number;
  totalMs: number;
  playing: boolean;
  speed: Speed;
  onSeek: (ms: number) => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStep: (delta: number) => void;
  onSpeed: (speed: Speed) => void;
  showCoachToggle: boolean;
  coachOn: boolean;
  onToggleCoach: () => void;
}) {
  return (
    <div
      className="panel"
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <input
        type="range"
        min={0}
        max={Math.max(1, totalMs)}
        step={10}
        value={Math.min(currentMs, totalMs)}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--gold)", cursor: "pointer" }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn btn-gold"
          onClick={onTogglePlay}
          style={{ padding: "8px 14px", fontSize: 13, minWidth: 86 }}
        >
          {playing ? "pause" : "play"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onRestart}
          style={{ padding: "8px 12px", fontSize: 13 }}
        >
          restart
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onStep(-1)}
          style={{ padding: "8px 11px", fontSize: 13 }}
        >
          {"<"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onStep(1)}
          style={{ padding: "8px 11px", fontSize: 13 }}
        >
          {">"}
        </button>
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--line-soft)",
            borderRadius: 6,
          }}
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className="mono upper"
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                padding: "6px 10px",
                background:
                  s === speed
                    ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
                    : "transparent",
                color: s === speed ? "#2a1d04" : "var(--ink-2)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {s}x
            </button>
          ))}
        </div>
        {showCoachToggle && (
          <button
            onClick={onToggleCoach}
            className="mono upper"
            title="Toggle AI coach for both replays"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              padding: "8px 12px",
              background: coachOn
                ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
                : "rgba(0,0,0,0.4)",
              color: coachOn ? "#2a1d04" : "var(--ink-2)",
              border: "1px solid var(--line-soft)",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {coachOn ? "● coach on" : "○ coach"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            letterSpacing: "0.08em",
          }}
        >
          {fmtTime(Math.floor(currentMs / 1000))} /{" "}
          {fmtTime(Math.floor(totalMs / 1000))}
        </div>
      </div>
    </div>
  );
}

function PlayerReplay({
  demo,
  frame,
  playerLabel,
  won,
  coach,
}: {
  demo: Demo;
  frame: ReturnType<typeof frameAt>;
  playerLabel: string;
  won: boolean;
  coach: CoachReport | null;
}) {
  const lastAction =
    frame.actionIndex > 0 ? demo.actions[frame.actionIndex - 1] : null;
  const highlight = lastAction
    ? { r: lastAction.r, c: lastAction.c }
    : demo.prePlant ?? null;
  const boomCell =
    demo.reason === "exploded" &&
    demo.actions.length > 0 &&
    frame.actionIndex >= demo.actions.length
      ? (() => {
          const last = demo.actions[demo.actions.length - 1];
          return last.kind === "reveal" || last.kind === "chord"
            ? { r: last.r, c: last.c }
            : null;
        })()
      : null;

  const primaryPattern = useMemo(
    () => pickPrimary(coach, lastAction),
    [coach, lastAction],
  );
  const patternCount = useMemo(() => {
    if (!coach || !primaryPattern) return 0;
    return (
      coach.patterns.filter((p) => p.name === primaryPattern.name).length - 1
    );
  }, [coach, primaryPattern]);
  const coachAnchors = primaryPattern?.anchors ?? [];

  return (
    <section
      className={won ? "panel panel-gold" : "panel"}
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          minWidth: 0,
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: won ? "var(--gold)" : "var(--ink-mute)",
          }}
        >
          {playerLabel}
        </div>
        <div
          className="disp"
          style={{
            fontSize: 24,
            fontWeight: 800,
            fontStyle: "italic",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {demo.country && (
            <span title={countryName(demo.country)} style={{ marginRight: 8 }}>
              {flagEmoji(demo.country)}
            </span>
          )}
          {demo.username}
        </div>
        <div style={{ flex: 1 }} />
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: won ? "var(--gold)" : "var(--ink-mute)",
          }}
        >
          {won ? "round winner" : reasonLabel(demo)}
        </div>
      </div>

      <div style={{ overflow: "auto", paddingBottom: 2 }}>
        <DemoBoard
          board={frame.board}
          cellSize={24}
          highlight={highlight}
          boomCell={boomCell}
          coach={coach}
          coachAnchors={coachAnchors}
        />
      </div>

      {coach && (
        <CoachTipStrip pattern={primaryPattern} patternCount={patternCount} />
      )}

      <div
        className="mono"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <Stat label="score" value={demo.score_total ?? 0} hot={won} />
        <Stat label="time" value={fmtTime(Math.floor(demo.elapsed_ms / 1000))} />
        <Stat label="opens" value={demo.opens} />
        <Stat label="clicks" value={demo.clicks} />
        <Stat label="hp lost" value={demo.mistakes ?? 0} danger={(demo.mistakes ?? 0) > 0} />
      </div>

      <div
        className="mono"
        style={{
          paddingTop: 10,
          borderTop: "1px solid var(--line-soft)",
          color: "var(--ink-2)",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span>
          {lastAction
            ? `${lastAction.kind} (${lastAction.r}, ${lastAction.c}) @ ${fmtTime(
                Math.floor(lastAction.atMs / 1000),
              )}`
            : "opening position"}
        </span>
        <span style={{ color: "var(--gold)" }}>
          {frame.actionIndex} / {demo.actions.length}
        </span>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hot,
  danger,
}: {
  label: string;
  value: ReactNode;
  hot?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "8px 10px",
        border: "1px solid var(--line-soft)",
        background: "rgba(0,0,0,0.28)",
        borderRadius: 7,
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
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          color: danger ? "var(--red-glow)" : hot ? "var(--gold)" : "var(--ink)",
          fontWeight: 800,
          fontSize: 15,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function reasonLabel(demo: Demo): string {
  if (demo.reason === "won") return "cleared";
  if (demo.reason === "exploded") return "exploded";
  if (demo.reason === "timeout") return "timed out";
  return "round loss";
}

function matchDemoPose(
  demo: MatchDemo,
  currentMs: number,
  total: number,
): MascotPose {
  if (currentMs <= 50) return "inspect";
  if (currentMs >= total - 50) {
    if (demo.winner === null) return "chipCount";
    const loser = demo.winner === 0 ? demo.player1 : demo.player0;
    return loser.reason === "exploded" ? "wince" : "approve";
  }
  const p0Idx = indexForMs(demo.player0, currentMs);
  const p1Idx = indexForMs(demo.player1, currentMs);
  const p0 = p0Idx > 0 ? demo.player0.actions[p0Idx - 1] : null;
  const p1 = p1Idx > 0 ? demo.player1.actions[p1Idx - 1] : null;
  if (p0?.kind === "flag" || p1?.kind === "flag") return "chipCount";
  return "point";
}

function matchDemoCaption(
  demo: MatchDemo,
  currentMs: number,
  total: number,
): string {
  if (currentMs <= 50) return "same seed, same opening";
  if (currentMs >= total - 50) {
    if (demo.winner === null) return "scores tied on the felt";
    const winner = demo.winner === 0 ? demo.player0 : demo.player1;
    return `${winner.username} won this round`;
  }
  return "compare the decision lines";
}
