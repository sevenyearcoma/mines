"use client";

import { useEffect, useRef } from "react";
import { bridge, type GameStats, type GameOverPayload } from "@/game/bridge";
import type { ActionLogEntry, RoundResult } from "@/lib/engine";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { capture } from "@/lib/analytics/posthog";
import { useAuth } from "./AuthProvider";

export type DailySaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

// Daily-challenge persistence. Saves one row per (user, UTC date) into the
// `daily_completions` table. The (user_id, date) PK guarantees a single row;
// `upsert` with `ignoreDuplicates: true` ensures a refresh after save can't
// overwrite the first attempt.
export function DailyRecorder({
  dateUtc,
  onSaveStateChange,
}: {
  dateUtc: string;
  onSaveStateChange?: (s: DailySaveState) => void;
}) {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const dateRef = useRef(dateUtc);
  dateRef.current = dateUtc;

  const statsRef = useRef<GameStats | null>(null);
  const actionsRef = useRef<ActionLogEntry[] | null>(null);
  const prePlantRef = useRef<{ r: number; c: number } | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();

    const onStats = (s: GameStats) => {
      statsRef.current = s;
    };

    const onRoundEnd = (result: RoundResult) => {
      if (result.config.mode !== "daily") return;
      actionsRef.current = result.actions;
      prePlantRef.current = result.config.prePlant ?? null;
    };

    const onOver = async (p: GameOverPayload) => {
      const s = statsRef.current;
      capture("daily_completed", {
        won: p.won,
        date: dateRef.current,
        seed: s?.seed,
        elapsed_ms: p.elapsedMs,
        opens: p.opens,
      });
      const u = userRef.current;
      if (!u) return;
      if (!s) return;
      onSaveStateChange?.({ kind: "saving" });
      try {
        const { error } = await supabase.from("daily_completions").upsert(
          {
            user_id: u.id,
            date: dateRef.current,
            seed: s.seed,
            won: p.won,
            elapsed_ms: p.elapsedMs,
            opens: p.opens,
            clicks: p.clicks,
            flagged: p.flagged,
            boom_r: p.boomCell?.r ?? null,
            boom_c: p.boomCell?.c ?? null,
            actions: actionsRef.current ?? null,
            pre_plant_r: prePlantRef.current?.r ?? null,
            pre_plant_c: prePlantRef.current?.c ?? null,
          },
          { onConflict: "user_id,date", ignoreDuplicates: true },
        );
        if (error) throw error;
        onSaveStateChange?.({ kind: "saved" });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save daily result";
        console.warn("[DailyRecorder] failed to persist:", err);
        onSaveStateChange?.({ kind: "error", message });
      }
    };

    bridge.on("stats:update", onStats);
    bridge.on("round:end", onRoundEnd);
    bridge.on("game:over", onOver);
    return () => {
      bridge.off("stats:update", onStats);
      bridge.off("round:end", onRoundEnd);
      bridge.off("game:over", onOver);
    };
  }, [onSaveStateChange]);

  return null;
}
