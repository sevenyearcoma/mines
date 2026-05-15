"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { roundConfigFromDifficulty } from "@/lib/engine";
import { useGameStats } from "@/components/hud/useGameStats";
import { useRecentGames } from "@/components/hud/useRecentGames";
import { TopHUD } from "@/components/hud/TopHUD";
import { SidePanel } from "@/components/hud/SidePanel";
import { ResultOverlay } from "@/components/hud/ResultOverlay";
import { GameRecorder, type SaveState } from "@/components/auth/GameRecorder";
import { MascotScene } from "@/components/mascot/MascotScene";

const PhaserGame = dynamic(() => import("@/game/PhaserGame"), {
  ssr: false,
});

export default function PlayPage() {
  const { stats, over } = useGameStats();
  const recentGames = useRecentGames();
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const mascot = over
    ? over.won
      ? { pose: "approve" as const, caption: "clean break — rack 'em again" }
      : { pose: "wince" as const, caption: "expensive click — try again" }
    : { pose: "inspect" as const, caption: "warming up the read" };

  // Mount-time round. Difficulty changes after mount happen via cmd:setDifficulty.
  const initialRound = useMemo(
    () => roundConfigFromDifficulty("intermediate", undefined, "casual"),
    [],
  );

  return (
    <div
      className="screen"
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <MascotScene pose={mascot.pose} caption={mascot.caption} />
      <TopHUD stats={stats} />
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          minHeight: 0,
        }}
      >
        <div style={{ position: "relative", overflow: "hidden" }}>
          <PhaserGame initialRound={initialRound} />
          <GameRecorder onSaveStateChange={setSave} />
          <ResultOverlay over={over} autoReset saveState={save} />
        </div>
        <SidePanel stats={stats} recentGames={recentGames} />
      </div>
    </div>
  );
}
