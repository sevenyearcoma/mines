"use client";

import { useEffect, useRef } from "react";
import type { RoundResult } from "@/lib/engine";
import { matchDemoId } from "@/lib/demo/types";
import type { RoundEndPayload } from "@/lib/multiplayer/protocol";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { MatchSnapshot } from "@/lib/store/match";
import { useAuth } from "@/components/auth/AuthProvider";

export function MatchDemoRecorder({
  snapshot,
  roundEnd,
  onSaved,
}: {
  snapshot: MatchSnapshot | null;
  roundEnd: RoundEndPayload | null;
  onSaved?: (id: string) => void;
}) {
  const { user } = useAuth();
  const savedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!user || !snapshot || !roundEnd) return;
    if (roundEnd.matchId !== snapshot.matchId) return;
    if (
      user.id !== snapshot.players[0].id &&
      user.id !== snapshot.players[1].id
    ) {
      return;
    }

    const id = matchDemoId(roundEnd.matchId, roundEnd.roundIndex);
    if (savedRef.current.has(id)) return;
    savedRef.current.add(id);

    const player0Result =
      snapshot.youAre === 0 ? roundEnd.yourResult : roundEnd.opponentResult;
    const player1Result =
      snapshot.youAre === 0 ? roundEnd.opponentResult : roundEnd.yourResult;

    void persistMatchDemo({
      id,
      snapshot,
      roundEnd,
      player0Result,
      player1Result,
      onSaved,
    }).catch((err) => {
      savedRef.current.delete(id);
      console.warn("[MatchDemoRecorder] failed to persist match demo:", err);
    });
  }, [onSaved, roundEnd, snapshot, user]);

  return null;
}

async function persistMatchDemo({
  id,
  snapshot,
  roundEnd,
  player0Result,
  player1Result,
  onSaved,
}: {
  id: string;
  snapshot: MatchSnapshot;
  roundEnd: RoundEndPayload;
  player0Result: RoundResult;
  player1Result: RoundResult;
  onSaved?: (id: string) => void;
}) {
  const supabase = getBrowserSupabase();
  const config = player0Result.config;
  const prePlant = config.prePlant ?? null;
  const { error } = await supabase.from("match_round_demos").upsert(
    {
      id,
      match_id: roundEnd.matchId,
      round_index: roundEnd.roundIndex,
      rows: config.rows,
      cols: config.cols,
      mines: config.mines,
      seed: config.seed,
      time_limit_ms: config.timeLimitMs,
      pre_plant_r: prePlant?.r ?? null,
      pre_plant_c: prePlant?.c ?? null,
      winner_index: roundEnd.winner,
      player0_id: snapshot.players[0].id,
      player1_id: snapshot.players[1].id,
      ...resultColumns("player0", player0Result),
      ...resultColumns("player1", player1Result),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  onSaved?.(id);
}

function resultColumns(prefix: "player0" | "player1", result: RoundResult) {
  return {
    [`${prefix}_reason`]: result.reason,
    [`${prefix}_elapsed_ms`]: result.elapsedMs,
    [`${prefix}_opens`]: result.opens,
    [`${prefix}_clicks`]: result.clicks,
    [`${prefix}_flagged`]: result.flagged,
    [`${prefix}_score`]: result.score.total,
    [`${prefix}_mistakes`]: result.score.mistakes,
    [`${prefix}_actions`]: result.actions,
  };
}
