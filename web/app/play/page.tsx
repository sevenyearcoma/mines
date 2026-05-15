"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { roundConfigFromDifficulty } from "@/lib/engine";
import { useGameStats } from "@/components/hud/useGameStats";
import { useRecentGames } from "@/components/hud/useRecentGames";
import { TopHUD } from "@/components/hud/TopHUD";
import { SidePanel } from "@/components/hud/SidePanel";
import { ResultOverlay } from "@/components/hud/ResultOverlay";
import { GameRecorder, type SaveState } from "@/components/auth/GameRecorder";
import { SoloProgressSync } from "@/components/auth/SoloProgressSync";
import { useAuth } from "@/components/auth/AuthProvider";
import { MascotScene } from "@/components/mascot/MascotScene";
import type { SoloProgressSnapshot } from "@/lib/solo/progress";
import { loadLatestSoloProgress } from "@/lib/solo/progressStorage";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), {
  ssr: false,
});

export default function PlayPage() {
  const { user, guest, loading } = useAuth();
  const { stats, over } = useGameStats();
  const recentGames = useRecentGames();
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [progressReady, setProgressReady] = useState(false);
  const [initialProgress, setInitialProgress] =
    useState<SoloProgressSnapshot | null>(null);

  const mascot = over
    ? over.won
      ? { pose: "approve" as const, caption: "clean break — rack 'em again" }
      : { pose: "wince" as const, caption: "expensive click — try again" }
    : { pose: "inspect" as const, caption: "warming up the read" };

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void loadLatestSoloProgress({
      userId: user?.id ?? null,
      guestId: guest?.id ?? null,
    }).then((progress) => {
      if (cancelled) return;
      setInitialProgress(progress);
      setProgressReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [guest?.id, loading, user?.id]);

  // Mount-time round. Difficulty changes after mount happen via SoloProgressSync.
  const initialRound = useMemo(
    () =>
      initialProgress?.round ??
      roundConfigFromDifficulty("intermediate", undefined, "casual"),
    [initialProgress],
  );

  if (!progressReady) {
    return (
      <div
        className="screen"
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          minHeight: 0,
        }}
      >
        <div className="mono upper" style={{ color: "var(--ink-mute)" }}>
          loading table...
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen play-screen"
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <MascotScene pose={mascot.pose} caption={mascot.caption} />
      <TopHUD stats={stats} />
      <div
        className="play-layout"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          minHeight: 0,
        }}
      >
        <div
          className="play-board-stage"
          style={{ position: "relative", overflow: "hidden" }}
        >
          <PhaserGame
            initialRound={initialRound}
            initialProgress={initialProgress}
          />
          <SoloProgressSync />
          <GameRecorder onSaveStateChange={setSave} />
          <ResultOverlay over={over} autoReset saveState={save} />
        </div>
        <SidePanel stats={stats} recentGames={recentGames} />
      </div>
    </div>
  );
}
