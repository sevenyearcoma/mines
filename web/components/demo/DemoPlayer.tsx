"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectCoach } from "@/lib/coach/detect";
import { frameAt, indexForMs, totalMs } from "@/lib/demo/playback";
import type { Demo } from "@/lib/demo/types";
import { fmtTime } from "@/lib/format";
import { flagEmoji, countryName } from "@/lib/leaderboard/country";
import { CoachPanel } from "./CoachPanel";
import { CoachTipStrip } from "./CoachTipStrip";
import { DemoBoard } from "./DemoBoard";
import { type MascotPose } from "@/components/mascot/MinosMascot";
import { useMascotPose } from "@/components/mascot/MascotRail";
import { useProMode } from "@/components/pro/ProProvider";

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

const COACH_STORAGE_KEY = "mines:demo:coach";
const STEP_MODE_KEY = "mines:demo:stepMode";

type StepMode = "action" | "pattern";

export function DemoPlayer({ demo }: { demo: Demo }) {
  const total = useMemo(() => totalMs(demo), [demo]);
  const { isPro } = useProMode();

  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  // Coach is ON by default; the user can flip it off. The preference is
  // persisted to localStorage so the next demo opens in their chosen mode.
  // When Pro is disabled the coach is hard-off regardless of the stored value.
  const [coachPref, setCoachPref] = useState<boolean>(true);
  const coachOn = isPro && coachPref;
  const [hoverPatternId, setHoverPatternId] = useState<string | null>(null);
  // Step mode: "pattern" (default) jumps between teachable moments,
  // "action" walks one input event at a time. Pattern stepping is a Pro
  // feature — fall back to action stepping when Pro is off.
  const [stepModePref, setStepModePref] = useState<StepMode>("pattern");
  const stepMode: StepMode = isPro ? stepModePref : "action";

  // Read the persisted preference on mount. Stored value `"0"` means off,
  // anything else (including null = no preference) means default ON.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COACH_STORAGE_KEY);
      if (stored === "0") setCoachPref(false);
      const sm = window.localStorage.getItem(STEP_MODE_KEY);
      if (sm === "action") setStepModePref("action");
    } catch {
      // storage disabled / quota — just stick with the default.
    }
  }, []);

  // Save on every flip.
  useEffect(() => {
    try {
      window.localStorage.setItem(COACH_STORAGE_KEY, coachPref ? "1" : "0");
    } catch {
      // ignore
    }
  }, [coachPref]);
  useEffect(() => {
    try {
      window.localStorage.setItem(STEP_MODE_KEY, stepModePref);
    } catch {
      // ignore
    }
  }, [stepModePref]);

  // rAF playback loop. We track wall-clock time at the start of the loop and
  // each frame compute the delta we should advance by (scaled by speed).
  const lastTickRef = useRef<number | null>(null);
  const currentMsRef = useRef(currentMs);
  currentMsRef.current = currentMs;

  useEffect(() => {
    if (!playing) {
      lastTickRef.current = null;
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      const last = lastTickRef.current ?? t;
      lastTickRef.current = t;
      const dt = (t - last) * speed;
      const next = currentMsRef.current + dt;
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

  // Auto-rewind to 0 when user hits play after playback hit the end.
  const onTogglePlay = useCallback(() => {
    if (currentMsRef.current >= total) setCurrentMs(0);
    setPlaying((p) => !p);
  }, [total]);

  const onSeek = useCallback(
    (ms: number) => {
      setCurrentMs(Math.max(0, Math.min(total, ms)));
    },
    [total],
  );

  // Pre-compute the list of "teachable" action indices for pattern stepping:
  // each entry is an action index where the coach surfaces at least one
  // pattern that wasn't visible at the previous milestone. Cached per demo so
  // we only run detectCoach across all frames once.
  const patternMilestones = useMemo(
    () => computePatternMilestones(demo),
    [demo],
  );

  const stepBy = useCallback(
    (delta: number) => {
      setPlaying(false);
      const idx = indexForMs(demo, currentMsRef.current);

      // Pattern mode: jump between teachable moments. Falls through to
      // action stepping if the demo has no patterns at all (or if we'd hit
      // a no-op at the milestone-list edge).
      if (stepMode === "pattern" && patternMilestones.length > 0) {
        const target = stepToMilestone(idx, delta, patternMilestones);
        if (target !== null) {
          setCurrentMs(
            target === 0 ? 0 : demo.actions[target - 1].atMs,
          );
          return;
        }
      }

      const nextIdx = Math.max(
        0,
        Math.min(demo.actions.length, idx + delta),
      );
      if (nextIdx === 0) {
        setCurrentMs(0);
        return;
      }
      setCurrentMs(demo.actions[nextIdx - 1].atMs);
    },
    [demo, stepMode, patternMilestones],
  );

  const frame = useMemo(() => {
    const idx = indexForMs(demo, currentMs);
    return frameAt(demo, idx);
  }, [demo, currentMs]);

  // Coach detection re-runs on each frame change. detectCoach is fast
  // (linear in board size for trivial rules + small constant for hardcoded
  // patterns); the useMemo just keeps it from re-running on coach toggle
  // alone.
  const coachReport = useMemo(
    () => (coachOn ? detectCoach(frame.board) : null),
    [coachOn, frame.board],
  );

  // The cell of the just-played move drives both the "highlight" outline AND
  // the coach's active pattern selection below. Declared early so the memo
  // for primaryPatternId can depend on it.
  const lastAction =
    frame.actionIndex > 0 ? demo.actions[frame.actionIndex - 1] : null;

  // The "active" pattern drives both the TipStrip below the board and the
  // gold anchor halo on the board itself. It tracks the move you're CURRENTLY
  // watching — find the pattern most relevant to the last action's cell. If
  // nothing relates, fall back to the most-teachable named pattern. Hover in
  // the side panel always wins.
  const primaryPatternId = useMemo(() => {
    if (!coachReport || coachReport.patterns.length === 0) return null;
    const NAMED = ["1-2-1", "1-2-2-1", "1-1 along wall"];

    if (lastAction) {
      const lr = lastAction.r;
      const lc = lastAction.c;
      // 1. The move IS an anchor of a pattern — the click revealed a number
      //    that completes the shape.
      const anchorHit = coachReport.patterns.find((p) =>
        p.anchors.some((a) => a.r === lr && a.c === lc),
      );
      if (anchorHit) return anchorHit.id;
      // 2. The move IS a conclusion (the player acted on a deduction, or
      //    stepped on a cell the coach had marked as a mine).
      const concHit = coachReport.patterns.find((p) =>
        p.conclusions.some((c) => c.r === lr && c.c === lc),
      );
      if (concHit) return concHit.id;
      // 3. The move is adjacent to an anchor — the player was working near
      //    a pattern even if their move wasn't part of it.
      const adjHit = coachReport.patterns.find((p) =>
        p.anchors.some(
          (a) => Math.abs(a.r - lr) <= 1 && Math.abs(a.c - lc) <= 1,
        ),
      );
      if (adjHit) return adjHit.id;
      // 4. Nearest pattern by Manhattan distance, preferring named ones on
      //    ties.
      let best = coachReport.patterns[0];
      let bestDist = Infinity;
      for (const p of coachReport.patterns) {
        const dist = p.anchors.reduce((acc, a) => {
          const d = Math.abs(a.r - lr) + Math.abs(a.c - lc);
          return d < acc ? d : acc;
        }, Infinity);
        const namedBoost = NAMED.includes(p.name) ? -0.5 : 0;
        if (dist + namedBoost < bestDist) {
          bestDist = dist + namedBoost;
          best = p;
        }
      }
      return best.id;
    }

    // No action yet (pristine frame) — lead with a named pattern if any.
    const named = coachReport.patterns.find((p) => NAMED.includes(p.name));
    return (named ?? coachReport.patterns[0]).id;
  }, [coachReport, lastAction]);

  const activePatternId = hoverPatternId ?? primaryPatternId;
  const activePattern = useMemo(() => {
    if (!coachOn || !coachReport || !activePatternId) return null;
    return coachReport.patterns.find((p) => p.id === activePatternId) ?? null;
  }, [coachOn, coachReport, activePatternId]);

  const activeAnchors = activePattern?.anchors;
  // How many other matches of the same pattern name exist — for the "x N on
  // board" chip in the strip.
  const activePatternCount = useMemo(() => {
    if (!coachReport || !activePattern) return 0;
    return coachReport.patterns.filter((p) => p.name === activePattern.name).length;
  }, [coachReport, activePattern]);

  const highlight = lastAction
    ? { r: lastAction.r, c: lastAction.c }
    : demo.prePlant ?? null;

  // Final action that ended the round = "boom cell" if the player lost.
  const boomCell =
    !demo.won && demo.actions.length > 0 && frame.actionIndex >= demo.actions.length
      ? (() => {
          const last = demo.actions[demo.actions.length - 1];
          return last.kind === "reveal" || last.kind === "chord"
            ? { r: last.r, c: last.c }
            : null;
        })()
      : null;

  const mascotPose: MascotPose = boomCell
    ? "wince"
    : activePattern
      ? "inspect"
      : lastAction
        ? "point"
        : demo.prePlant
          ? "approve"
          : "idle";
  const mascotCaption = boomCell
    ? "that click broke the line"
    : activePattern
      ? `${activePattern.name} on the table`
      : lastAction
        ? `${lastAction.kind} at ${lastAction.r}, ${lastAction.c}`
        : demo.prePlant
          ? "fixed opening, clean read"
          : "watch the first plant";

  useMascotPose(mascotPose, mascotCaption);

  // Keyboard shortcuts: space=play, ←/→=step, ↑/↓=speed.
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
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const i = SPEEDS.indexOf(speed);
        if (i < SPEEDS.length - 1) setSpeed(SPEEDS[i + 1]);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const i = SPEEDS.indexOf(speed);
        if (i > 0) setSpeed(SPEEDS[i - 1]);
      } else if (e.code === "KeyC") {
        e.preventDefault();
        setCoachPref((v) => !v);
      } else if (e.code === "KeyP") {
        e.preventDefault();
        setStepModePref((m) => (m === "pattern" ? "action" : "pattern"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTogglePlay, stepBy, speed]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        gap: 24,
        padding: "24px 28px 48px clamp(72px, 9vw, 140px)",
        maxWidth: 1180,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          minWidth: 0,
        }}
      >
        <DemoBoard
          board={frame.board}
          cellSize={32}
          highlight={highlight}
          boomCell={boomCell}
          coach={coachReport}
          coachAnchors={activeAnchors}
        />
        {coachOn && (
          <CoachTipStrip
            pattern={activePattern}
            patternCount={activePatternCount}
          />
        )}
        <Controls
          currentMs={currentMs}
          totalMs={total}
          isPro={isPro}
          coachOn={coachOn}
          onToggleCoach={() => setCoachPref((v) => !v)}
          stepMode={stepMode}
          onStepMode={setStepModePref}
          milestoneCount={patternMilestones.length}
          milestonePos={milestonePosition(
            frame.actionIndex,
            patternMilestones,
          )}
          playing={playing}
          speed={speed}
          actionIndex={frame.actionIndex}
          totalActions={demo.actions.length}
          onTogglePlay={onTogglePlay}
          onSeek={onSeek}
          onSpeed={setSpeed}
          onStep={stepBy}
          onRestart={() => {
            setPlaying(false);
            setCurrentMs(0);
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Sidebar demo={demo} frame={frame} lastAction={lastAction} />
        {coachOn && coachReport && (
          <CoachPanel
            report={coachReport}
            hoverPatternId={hoverPatternId}
            onHoverPattern={setHoverPatternId}
          />
        )}
      </div>
    </div>
  );
}

function Controls({
  currentMs,
  totalMs,
  playing,
  speed,
  actionIndex,
  totalActions,
  isPro,
  coachOn,
  onToggleCoach,
  stepMode,
  onStepMode,
  milestoneCount,
  milestonePos,
  onTogglePlay,
  onSeek,
  onSpeed,
  onStep,
  onRestart,
}: {
  currentMs: number;
  totalMs: number;
  playing: boolean;
  speed: Speed;
  actionIndex: number;
  totalActions: number;
  isPro: boolean;
  coachOn: boolean;
  onToggleCoach: () => void;
  stepMode: StepMode;
  onStepMode: (m: StepMode) => void;
  milestoneCount: number;
  milestonePos: number;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  onSpeed: (s: Speed) => void;
  onStep: (delta: number) => void;
  onRestart: () => void;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 720,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Scrubber currentMs={currentMs} totalMs={totalMs} onSeek={onSeek} />
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
          style={{ padding: "8px 14px", fontSize: 13, minWidth: 90 }}
          aria-label={playing ? "pause" : "play"}
        >
          {playing ? "❙❙ pause" : "▶ play"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onRestart}
          style={{ padding: "8px 12px", fontSize: 13 }}
        >
          ↻ restart
        </button>

        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          <button
            className="btn btn-ghost"
            onClick={() => onStep(-1)}
            style={{ padding: "8px 10px", fontSize: 13 }}
            title={
              stepMode === "pattern"
                ? "previous pattern (←)"
                : "step back (←)"
            }
          >
            ‹
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => onStep(1)}
            style={{ padding: "8px 10px", fontSize: 13 }}
            title={
              stepMode === "pattern"
                ? "next pattern (→)"
                : "step forward (→)"
            }
          >
            ›
          </button>
        </div>

        {/* step-mode toggle: by-pattern (default, Pro) vs by-action */}
        {isPro && (
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--line-soft)",
            borderRadius: 6,
            marginLeft: 4,
          }}
          title="Toggle step mode (P)"
        >
          {(["pattern", "action"] as const).map((m) => {
            const disabled = m === "pattern" && milestoneCount === 0;
            const active = stepMode === m;
            return (
              <button
                key={m}
                onClick={() => !disabled && onStepMode(m)}
                disabled={disabled}
                className="mono upper"
                title={
                  disabled
                    ? "no patterns detected in this demo"
                    : m === "pattern"
                    ? "step jumps to each new teaching moment"
                    : "step walks one input at a time"
                }
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "6px 10px",
                  background: active
                    ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
                    : "transparent",
                  color: active
                    ? "#2a1d04"
                    : disabled
                    ? "rgba(200,200,200,0.32)"
                    : "var(--ink-2)",
                  border: "none",
                  borderRadius: 4,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                {m === "pattern" ? "by pattern" : "by action"}
              </button>
            );
          })}
        </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 3,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--line-soft)",
            borderRadius: 6,
            marginLeft: 4,
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
              {s}×
            </button>
          ))}
        </div>

        {isPro && (
          <button
            onClick={onToggleCoach}
            className="mono upper"
            title="Toggle pattern coach (C)"
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
              marginLeft: 4,
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
          {fmtTime(Math.floor(currentMs / 1000))} / {fmtTime(Math.floor(totalMs / 1000))}
          <span style={{ marginLeft: 14, color: "var(--gold)" }}>
            {stepMode === "pattern" && milestoneCount > 0
              ? `pattern ${milestonePos} / ${milestoneCount}`
              : `${actionIndex} / ${totalActions}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function Scrubber({
  currentMs,
  totalMs,
  onSeek,
}: {
  currentMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={Math.max(1, totalMs)}
      step={10}
      value={Math.min(currentMs, totalMs)}
      onChange={(e) => onSeek(Number(e.target.value))}
      style={{
        width: "100%",
        accentColor: "var(--gold)",
        cursor: "pointer",
      }}
    />
  );
}

function Sidebar({
  demo,
  frame,
  lastAction,
}: {
  demo: Demo;
  frame: { actionIndex: number };
  lastAction: ReturnType<typeof Object> | null;
}) {
  const a = lastAction as { kind: string; r: number; c: number; atMs: number } | null;
  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "rgba(0,0,0,0.32)",
        height: "fit-content",
      }}
    >
      <div>
        <div
          className="mono upper"
          style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--ink-mute)" }}
        >
          {demo.kind === "daily" ? `daily · ${demo.date ?? ""}` : "solo demo"}
        </div>
        <div
          className="disp"
          style={{
            fontSize: 22,
            fontWeight: 800,
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {demo.country && (
            <span title={countryName(demo.country)}>{flagEmoji(demo.country)}</span>
          )}
          {demo.username}
        </div>
      </div>

      <div
        className="mono"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "4px 12px",
          fontSize: 12,
          color: "var(--ink-2)",
        }}
      >
        <span style={{ color: "var(--ink-mute)" }}>result</span>
        <span style={{ color: demo.won ? "var(--gold)" : "var(--red-glow)", fontWeight: 700 }}>
          {demo.won ? "cleared" : "busted"}
        </span>
        <span style={{ color: "var(--ink-mute)" }}>time</span>
        <span>{fmtTime(Math.floor(demo.elapsed_ms / 1000))}</span>
        <span style={{ color: "var(--ink-mute)" }}>opens</span>
        <span>{demo.opens}</span>
        <span style={{ color: "var(--ink-mute)" }}>clicks</span>
        <span>{demo.clicks}</span>
        <span style={{ color: "var(--ink-mute)" }}>flagged</span>
        <span>{demo.flagged}</span>
        <span style={{ color: "var(--ink-mute)" }}>played</span>
        <span>{new Date(demo.played_at).toLocaleDateString()}</span>
      </div>

      <div
        style={{
          marginTop: 4,
          paddingTop: 10,
          borderTop: "1px solid var(--line-soft)",
        }}
      >
        <div
          className="mono upper"
          style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--ink-mute)" }}
        >
          current frame
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--ink)", marginTop: 6 }}>
          {a
            ? `${a.kind} · (${a.r}, ${a.c}) @ ${fmtTime(Math.floor(a.atMs / 1000))}`
            : "pristine board"}
        </div>
        <div
          className="mono"
          style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 8 }}
        >
          action {frame.actionIndex} of {demo.actions.length}
        </div>
      </div>

      <div
        className="mono upper"
        style={{
          marginTop: 4,
          paddingTop: 10,
          borderTop: "1px solid var(--line-soft)",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--ink-mute)",
          lineHeight: 1.6,
        }}
      >
        space · play / pause<br />
        ← / → · step (shift = ×10)<br />
        ↑ / ↓ · speed<br />
        c · coach overlay<br />
        p · pattern / action stepping
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Pattern stepping helpers
// ---------------------------------------------------------------------------

// Walk every frame from pristine → end-of-demo and collect the action indices
// where the coach surfaces a NEW pattern (one whose id wasn't present at the
// previous milestone). The resulting list is the player's "teachable
// moments" — each new shape that emerged in the run.
function computePatternMilestones(demo: Demo): number[] {
  if (!demo.actions.length) return [];
  const milestones: number[] = [];
  const seen = new Set<string>();
  for (let i = 0; i <= demo.actions.length; i++) {
    const f = frameAt(demo, i);
    const report = detectCoach(f.board);
    if (report.patterns.length === 0) continue;
    let hasNew = false;
    const currentIds: string[] = [];
    for (const p of report.patterns) {
      currentIds.push(p.id);
      if (!seen.has(p.id)) hasNew = true;
    }
    if (hasNew) {
      milestones.push(i);
      for (const id of currentIds) seen.add(id);
    }
  }
  return milestones;
}

// 1-indexed position within the milestone list for the current action index.
// Returns 0 if before the first milestone, milestoneCount if past the last.
// Used for the "step X / N" readout in pattern mode.
function milestonePosition(currentIdx: number, milestones: number[]): number {
  if (milestones.length === 0) return 0;
  let pos = 0;
  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i] <= currentIdx) pos = i + 1;
    else break;
  }
  return pos;
}

// Jump within the milestone list relative to the current action index. delta
// > 0 moves forward by that many milestones; delta < 0 moves backward.
// Returns the target action index, or null if the milestone list is empty.
function stepToMilestone(
  currentIdx: number,
  delta: number,
  milestones: number[],
): number | null {
  if (milestones.length === 0 || delta === 0) return null;
  if (delta > 0) {
    // First milestone strictly after currentIdx.
    const i = milestones.findIndex((m) => m > currentIdx);
    if (i === -1) return milestones[milestones.length - 1];
    return milestones[Math.min(i + delta - 1, milestones.length - 1)];
  }
  // delta < 0: last milestone strictly before currentIdx.
  let last = -1;
  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i] < currentIdx) last = i;
    else break;
  }
  if (last === -1) return milestones[0];
  return milestones[Math.max(last + delta + 1, 0)];
}
