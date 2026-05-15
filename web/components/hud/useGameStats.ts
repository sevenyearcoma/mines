"use client";

import { useEffect, useState } from "react";
import { bridge, type GameStats, type GameOverPayload } from "@/game/bridge";
import { DIFFS, type Difficulty } from "@/lib/engine";

const ZERO_SCORE = {
  base: 0,
  combo: 0,
  speed: 0,
  control: 0,
  penalty: 0,
  peakStreak: 0,
  peakAccuracyStreak: 0,
  peakMultiplier: 1,
  peakSpeedMultiplier: 1,
  peakAccuracyMultiplier: 1,
  mistakes: 0,
  total: 0,
};

const initial: GameStats = {
  elapsedMs: 0,
  opens: 0,
  clicks: 0,
  chains: 0,
  flagged: 0,
  remaining: DIFFS.intermediate.mines,
  streak: 0,
  streakBest: 0,
  difficulty: "intermediate" as Difficulty,
  seed: 0,
  score: ZERO_SCORE,
  liveStreak: 0,
  liveMultiplier: 1,
  liveSpeedMultiplier: 1,
  liveAccuracyMultiplier: 1,
  accuracyStreak: 0,
  lives: 2,
  maxLives: 2,
  stunRemainingMs: 0,
  timeLeftMs: null,
  cellsRevealed: 0,
};

export function useGameStats() {
  const [stats, setStats] = useState<GameStats>(initial);
  const [over, setOver] = useState<GameOverPayload | null>(null);

  useEffect(() => {
    const onStats = (s: GameStats) => setStats(s);
    const onOver = (p: GameOverPayload) => setOver(p);
    const onStart = () => setOver(null);
    const onReset = () => setOver(null);
    bridge.on("stats:update", onStats);
    bridge.on("game:over", onOver);
    bridge.on("game:start", onStart);
    bridge.on("game:reset", onReset);
    return () => {
      bridge.off("stats:update", onStats);
      bridge.off("game:over", onOver);
      bridge.off("game:start", onStart);
      bridge.off("game:reset", onReset);
    };
  }, []);

  return { stats, over };
}
