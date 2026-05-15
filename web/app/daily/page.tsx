"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { dailyRoundConfig, todayUtcDate } from "@/lib/engine";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGameStats } from "@/components/hud/useGameStats";
import { DailyRecorder, type DailySaveState } from "@/components/auth/DailyRecorder";
import { ComboBadge } from "@/components/hud/ComboBadge";
import { HudReadout } from "@/components/primitives/HudReadout";
import { Ornament } from "@/components/primitives/Ornament";
import { fmtTime, pad } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { MascotScene } from "@/components/mascot/MascotScene";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), {
  ssr: false,
});

type Completion = {
  won: boolean;
  elapsed_ms: number;
  opens: number;
  clicks: number;
  flagged: number;
  played_at: string;
};

type Phase =
  | { kind: "loading" }
  | { kind: "unauth" }
  | { kind: "ready" }
  | { kind: "already-played"; completion: Completion };

// Per-day localStorage marker. Used so a refresh during the network save
// still locks the page — the supabase row is the source of truth, but local
// storage is the offline-safe net.
const LOCAL_KEY_PREFIX = "mines:daily:";
const localKey = (dateUtc: string) => `${LOCAL_KEY_PREFIX}${dateUtc}`;

function readLocal(dateUtc: string): Completion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localKey(dateUtc));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Completion;
    if (typeof parsed.won !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(dateUtc: string, c: Completion) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(dateUtc), JSON.stringify(c));
  } catch {
    // quota / disabled storage — best effort.
  }
}

export default function DailyPage() {
  const { user, isGuest, loading } = useAuth();
  const dateUtc = useMemo(() => todayUtcDate(), []);
  const round = useMemo(() => dailyRoundConfig(dateUtc), [dateUtc]);

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const { stats, over } = useGameStats();
  const [save, setSave] = useState<DailySaveState>({ kind: "idle" });
  // Once the page enters the locked state in this session, don't let any
  // later async resolution (in-flight save, late completion fetch) bounce
  // us back into "ready".
  const lockedRef = useRef(false);

  // Resolve gate state: auth check → local-storage check → supabase lookup.
  useEffect(() => {
    if (loading) {
      setPhase({ kind: "loading" });
      return;
    }
    if (!user && !isGuest) {
      setPhase({ kind: "unauth" });
      return;
    }
    // Fast path: the device already saw a completion today. Lock immediately
    // so a refresh between bust and save can't grant a retry. Local lock works
    // for guests too — they just don't get the cross-device sync.
    const local = readLocal(dateUtc);
    if (local) {
      lockedRef.current = true;
      setPhase({ kind: "already-played", completion: local });
      return;
    }
    if (!user) {
      // Guest: no cross-device lookup, jump straight to ready.
      setPhase({ kind: "ready" });
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = getBrowserSupabase();
      const { data, error } = await supabase
        .from("daily_completions")
        .select("won, elapsed_ms, opens, clicks, flagged, played_at")
        .eq("user_id", user.id)
        .eq("date", dateUtc)
        .maybeSingle();
      if (cancelled || lockedRef.current) return;
      if (error) {
        console.warn("[daily] completion lookup failed:", error);
        setPhase({ kind: "ready" });
        return;
      }
      if (data) {
        const completion = data as Completion;
        writeLocal(dateUtc, completion);
        lockedRef.current = true;
        setPhase({ kind: "already-played", completion });
        return;
      }
      setPhase({ kind: "ready" });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isGuest, loading, dateUtc]);

  // The moment Phaser reports a game-over, persist the completion locally so
  // a refresh during the network save still locks. The page itself stays in
  // "ready" so the player gets to see the cinematic BUSTED / COMPLETED card —
  // any subsequent navigation back to /daily will check localStorage on mount
  // and bounce to the "already played" lock state.
  useEffect(() => {
    if (!over) return;
    if (lockedRef.current) return;
    const completion: Completion = {
      won: over.won,
      elapsed_ms: over.elapsedMs,
      opens: over.opens,
      clicks: over.clicks,
      flagged: over.flagged,
      played_at: new Date().toISOString(),
    };
    writeLocal(dateUtc, completion);
    lockedRef.current = true;
  }, [over, dateUtc]);

  if (phase.kind === "loading") {
    return <CenteredScreen>connecting…</CenteredScreen>;
  }
  if (phase.kind === "unauth") {
    return (
      <CenteredScreen>
        <MascotScene pose="waiting" caption="claim a seat to play today's board" />
        <Banner />
        <p style={{ color: "var(--ink-mute)", marginTop: 18, marginBottom: 18 }}>
          sign in to attempt today&apos;s board.
        </p>
        <Link className="btn btn-gold sparkle" href="/auth/sign-in">
          sign in
        </Link>
      </CenteredScreen>
    );
  }
  if (phase.kind === "already-played") {
    return (
      <CenteredScreen>
        <MascotScene
          pose={phase.completion.won ? "approve" : "wince"}
          caption={
            phase.completion.won
              ? "today's table is closed — gg"
              : "come back tomorrow"
          }
        />
        <AlreadyPlayed completion={phase.completion} dateUtc={dateUtc} />
      </CenteredScreen>
    );
  }

  const dailyMascot = over
    ? over.won
      ? { pose: "approve" as const, caption: "you cleared today's table" }
      : { pose: "wince" as const, caption: "one life — back tomorrow" }
    : { pose: "allIn" as const, caption: "one life · all chips in" };

  return (
    <div
      className="screen"
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <MascotScene pose={dailyMascot.pose} caption={dailyMascot.caption} />
      <DailyHUD dateUtc={dateUtc} stats={stats} />
      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <PhaserGame key={`daily-${dateUtc}`} initialRound={round} />
        <DailyRecorder dateUtc={dateUtc} onSaveStateChange={setSave} />
        <DailyResultOverlay over={over} save={save} />
      </div>
    </div>
  );
}

function Banner() {
  return (
    <>
      <div className="mono upper" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--red, #ff8a8a)" }}>
        ● daily challenge
      </div>
      <div
        className="disp"
        style={{
          fontSize: 56,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          marginTop: 4,
        }}
      >
        <span className="foil">ONE LIFE</span>
      </div>
      <div
        className="mono upper"
        style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--ink-mute)", marginTop: 6 }}
      >
        pure hardcore · same seed for everyone
      </div>
    </>
  );
}

function DailyHUD({ dateUtc, stats }: { dateUtc: string; stats: ReturnType<typeof useGameStats>["stats"] }) {
  const seconds = Math.floor(stats.elapsedMs / 1000);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 180 }}>
        <div className="mono upper" style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--red, #ff8a8a)" }}>
          ● daily · {dateUtc}
        </div>
        <div className="disp" style={{ fontSize: 22, fontStyle: "italic", lineHeight: 1 }}>
          <span className="foil">one life, pure hardcore</span>
        </div>
      </div>

      <div style={{ width: 1, height: 36, background: "var(--line)" }} />

      <HudReadout label="mines" value={pad(stats.remaining)} tone="red" minWidth={110} />
      <HudReadout label="time" value={fmtTime(seconds)} tone="gold" minWidth={130} />
      <HudReadout label="opens" value={pad(stats.opens)} tone="gold" minWidth={100} />

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
    </div>
  );
}

function DailyResultOverlay({
  over,
  save,
}: {
  over: ReturnType<typeof useGameStats>["over"];
  save: DailySaveState;
}) {
  return (
    <AnimatePresence>
      {over && (
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
              "radial-gradient(ellipse at center, rgba(0,0,0,.55), rgba(0,0,0,.88))",
            backdropFilter: "blur(2px)",
            zIndex: 50,
          }}
        >
          <motion.div
            initial={{ y: 12, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 6, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className={over.won ? "panel panel-gold" : "panel"}
            style={{
              width: 460,
              padding: 32,
              textAlign: "center",
              borderColor: over.won ? "var(--gold-deep)" : "var(--red-deep)",
            }}
          >
            <Ornament w={120} color={over.won ? "var(--gold)" : "var(--red)"} />
            <div
              className="disp"
              style={{
                fontSize: 64,
                marginTop: 8,
                fontStyle: "italic",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              <span
                className={over.won ? "foil" : ""}
                style={
                  !over.won
                    ? { color: "var(--red-glow)", textShadow: "0 0 24px rgba(255,106,106,.6), 0 2px 0 #000" }
                    : {}
                }
              >
                {over.won ? "COMPLETED" : "BUSTED"}
              </span>
            </div>
            <div className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 12 }}>
              {over.won
                ? `cleared in ${fmtTime(Math.floor(over.elapsedMs / 1000))}`
                : "you only had one life. come back tomorrow."}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                margin: "22px 0 8px",
              }}
            >
              <HudReadout label="time" value={fmtTime(Math.floor(over.elapsedMs / 1000))} tone={over.won ? "gold" : "red"} />
              <HudReadout label="opens" value={over.opens} tone={over.won ? "gold" : "red"} />
              <HudReadout label="clicks" value={over.clicks} tone={over.won ? "gold" : "red"} />
            </div>

            <SaveBadge save={save} />

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
              <Link className="btn btn-gold sparkle" href="/">
                back to lobby
              </Link>
              <Link className="btn btn-ghost" href="/play">
                solo sprint
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AlreadyPlayed({ completion, dateUtc }: { completion: Completion; dateUtc: string }) {
  const won = completion.won;
  return (
    <div
      className={won ? "panel panel-gold" : "panel"}
      style={{
        width: 460,
        padding: 32,
        textAlign: "center",
        borderColor: won ? "var(--gold-deep)" : "var(--red-deep)",
      }}
    >
      <Ornament w={120} color={won ? "var(--gold)" : "var(--red)"} />
      <div className="mono upper" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--red, #ff8a8a)", marginTop: 6 }}>
        ● daily · {dateUtc}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 56,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          marginTop: 8,
          lineHeight: 1,
        }}
      >
        <span
          className={won ? "foil" : ""}
          style={
            !won
              ? { color: "var(--red-glow)", textShadow: "0 0 24px rgba(255,106,106,.6), 0 2px 0 #000" }
              : {}
          }
        >
          {won ? "COMPLETED ✓" : "BUSTED"}
        </span>
      </div>
      <div className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 10 }}>
        {won
          ? `cleared in ${fmtTime(Math.floor(completion.elapsed_ms / 1000))}`
          : "you only had one life. come back tomorrow."}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          margin: "22px 0 8px",
        }}
      >
        <HudReadout label="time" value={fmtTime(Math.floor(completion.elapsed_ms / 1000))} tone={won ? "gold" : "red"} />
        <HudReadout label="opens" value={completion.opens} tone={won ? "gold" : "red"} />
        <HudReadout label="clicks" value={completion.clicks} tone={won ? "gold" : "red"} />
      </div>

      <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 18 }}>
        next challenge at 00:00 UTC
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
        <Link className="btn btn-gold sparkle" href="/">
          back to lobby
        </Link>
        <Link className="btn btn-ghost" href="/play">
          solo sprint
        </Link>
      </div>
    </div>
  );
}

function SaveBadge({ save }: { save: DailySaveState }) {
  if (save.kind === "idle") return null;
  return (
    <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
      {save.kind === "saving" && <span className="chip" style={{ color: "var(--ink-mute)" }}>saving result…</span>}
      {save.kind === "saved" && <span className="chip chip-green">recorded ✓</span>}
      {save.kind === "error" && <span className="chip chip-red">save failed</span>}
    </div>
  );
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="screen"
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        minHeight: 0,
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 520 }}>{children}</div>
    </div>
  );
}
