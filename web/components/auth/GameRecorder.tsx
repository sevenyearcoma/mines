"use client";

import { useEffect, useRef } from "react";
import { bridge, type GameStats, type GameOverPayload } from "@/game/bridge";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error" };

export function GameRecorder({
  onSaveStateChange,
}: {
  onSaveStateChange?: (s: SaveState) => void;
}) {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const statsRef = useRef<GameStats | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();

    const onStats = (s: GameStats) => {
      statsRef.current = s;
    };
    const onStart = () => {
      onSaveStateChange?.({ kind: "idle" });
    };
    const onReset = () => {
      onSaveStateChange?.({ kind: "idle" });
    };

    const onOver = async (p: GameOverPayload) => {
      const u = userRef.current;
      if (!u) return;
      const s = statsRef.current;
      if (!s) return;
      onSaveStateChange?.({ kind: "saving" });
      try {
        const { error } = await supabase.from("games").insert({
          user_id: u.id,
          difficulty: s.difficulty,
          seed: s.seed,
          won: p.won,
          elapsed_ms: p.elapsedMs,
          opens: p.opens,
          clicks: p.clicks,
          flagged: p.flagged,
          post_loss_hint_count: p.postLossHintCount,
          boom_r: p.boomCell?.r ?? null,
          boom_c: p.boomCell?.c ?? null,
        });
        if (error) throw error;
        onSaveStateChange?.({ kind: "saved" });
      } catch (err) {
        console.warn("[GameRecorder] failed to persist game:", err);
        onSaveStateChange?.({ kind: "error" });
      }
    };

    bridge.on("stats:update", onStats);
    bridge.on("game:start", onStart);
    bridge.on("game:reset", onReset);
    bridge.on("game:over", onOver);
    return () => {
      bridge.off("stats:update", onStats);
      bridge.off("game:start", onStart);
      bridge.off("game:reset", onReset);
      bridge.off("game:over", onOver);
    };
  }, [onSaveStateChange]);

  return null;
}
