"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import { bridge } from "@/game/bridge";
import { MinosMascot, type MascotPose } from "./MinosMascot";

type MascotState = {
  pose: MascotPose;
  caption: string | null;
};

type MascotContextValue = MascotState & {
  setPose: (pose: MascotPose) => void;
  setCaption: (caption: string | null) => void;
  set: (next: Partial<MascotState>) => void;
};

const MascotContext = createContext<MascotContextValue | null>(null);

export function MascotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MascotState>({ pose: "idle", caption: null });

  const setPose = useCallback((pose: MascotPose) => {
    setState((s) => (s.pose === pose ? s : { ...s, pose }));
  }, []);
  const setCaption = useCallback((caption: string | null) => {
    setState((s) => (s.caption === caption ? s : { ...s, caption }));
  }, []);
  const set = useCallback((next: Partial<MascotState>) => {
    setState((s) => {
      const nextPose = next.pose ?? s.pose;
      const nextCaption = next.caption === undefined ? s.caption : next.caption;
      if (nextPose === s.pose && nextCaption === s.caption) return s;
      return { pose: nextPose, caption: nextCaption };
    });
  }, []);

  const value = useMemo<MascotContextValue>(
    () => ({
      ...state,
      setPose,
      setCaption,
      set,
    }),
    [state, setPose, setCaption, set],
  );
  return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

export function useMascot() {
  const ctx = useContext(MascotContext);
  if (!ctx) throw new Error("useMascot must be used inside MascotProvider");
  return ctx;
}

export function useMascotPose(pose: MascotPose, caption: string | null) {
  const { set } = useMascot();
  useEffect(() => {
    set({ pose, caption });
    return () => set({ pose: "idle", caption: null });
  }, [pose, caption, set]);
}

// Combo hype — accumulates per safe reveal, resets on hesitation/mistake/game end.
// Each tick adds a small opacity + scale bump up to a ceiling so the mascot
// gradually leans in as a chain builds, without flashing.
const MAX_HYPE = 10;
const BASE_OPACITY = 0.5;
const MAX_OPACITY = 0.85;
const SCALE_PER_HYPE = 0.02;
const WINCE_MS_DEFAULT = 3000;
const WINCE_OPACITY = 0.78;

export function MascotRail() {
  const ctx = useContext(MascotContext);
  const [hype, setHype] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wincing, setWincing] = useState(false);
  const winceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const fireWince = (durationMs?: number) => {
      setHype(0);
      setStreak(0);
      setWincing(true);
      if (winceTimerRef.current !== null) {
        window.clearTimeout(winceTimerRef.current);
      }
      const ms = durationMs && durationMs > 0 ? durationMs : WINCE_MS_DEFAULT;
      winceTimerRef.current = window.setTimeout(() => {
        setWincing(false);
        winceTimerRef.current = null;
      }, ms);
    };

    const onReveal = (p: {
      streak?: number;
      multiplier?: number;
      hesitated?: boolean;
    }) => {
      const inCombo = (p.streak ?? 0) >= 2;
      if (p.hesitated || !inCombo) {
        setHype(0);
        setStreak(p.streak ?? 0);
        return;
      }
      setHype((h) => Math.min(h + 1, MAX_HYPE));
      setStreak(p.streak ?? 0);
    };
    // Sync wince duration with the engine's actual stun window (3s in casual,
    // configurable in PvP) so the mascot recovers exactly when the player can
    // play again.
    const onMistake = (p: { stunMs?: number }) => fireWince(p?.stunMs);
    const onBoom = () => fireWince();
    const onOver = (p: { won: boolean }) => {
      if (!p.won) fireWince();
      else {
        setHype(0);
        setStreak(0);
      }
    };
    const fullReset = () => {
      setHype(0);
      setStreak(0);
      setWincing(false);
      if (winceTimerRef.current !== null) {
        window.clearTimeout(winceTimerRef.current);
        winceTimerRef.current = null;
      }
    };

    bridge.on("sound:reveal", onReveal);
    bridge.on("sound:mistake", onMistake);
    bridge.on("sound:boom", onBoom);
    bridge.on("game:over", onOver);
    bridge.on("game:start", fullReset);
    bridge.on("game:reset", fullReset);
    return () => {
      bridge.off("sound:reveal", onReveal);
      bridge.off("sound:mistake", onMistake);
      bridge.off("sound:boom", onBoom);
      bridge.off("game:over", onOver);
      bridge.off("game:start", fullReset);
      bridge.off("game:reset", fullReset);
      if (winceTimerRef.current !== null) {
        window.clearTimeout(winceTimerRef.current);
        winceTimerRef.current = null;
      }
    };
  }, []);

  // If the page-level pose moves to a loss state, drop any pending hype too.
  useEffect(() => {
    if (ctx?.pose === "wince" || ctx?.pose === "waiting") {
      setHype(0);
      setStreak(0);
    }
  }, [ctx?.pose]);

  const hyped = hype > 0 && !wincing;
  const pose: MascotPose = wincing
    ? "wince"
    : hyped
      ? "approve"
      : ctx?.pose ?? "idle";
  const caption = wincing
    ? "ouch — that one stung"
    : hyped
      ? `combo · ${streak} chain`
      : ctx?.caption ?? null;

  const opacity = wincing
    ? WINCE_OPACITY
    : BASE_OPACITY + (MAX_OPACITY - BASE_OPACITY) * (hype / MAX_HYPE);
  const scale = wincing ? 1.04 : 1 + SCALE_PER_HYPE * hype;

  return (
    <>
      <aside
        className={"mascot-rail" + (wincing ? " mascot-rail-wince" : "")}
        aria-hidden
      >
        <div
          className="mascot-rail-figure"
          style={{
            opacity,
            transform: `scale(${scale})`,
            transformOrigin: "left bottom",
          }}
        >
          <MinosMascot pose={pose} size={992} variant="cutout" side="left" />
        </div>
      </aside>
      {caption && (
        <div
          className={
            "mascot-rail-caption mono upper" +
            (wincing
              ? " mascot-rail-caption-wince"
              : hyped
                ? " mascot-rail-caption-hype"
                : "")
          }
        >
          {caption}
        </div>
      )}
    </>
  );
}
