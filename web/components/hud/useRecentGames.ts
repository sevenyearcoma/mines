"use client";

import { useEffect, useState } from "react";
import { bridge } from "@/game/bridge";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Game } from "@/lib/types/db";

const LIMIT = 10;

export function useRecentGames(): Game[] | null {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    if (!user) {
      setGames(null);
      return;
    }
    const supabase = getBrowserSupabase();
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("games")
        .select("*")
        .eq("user_id", user.id)
        .order("played_at", { ascending: false })
        .limit(LIMIT);
      if (!cancelled) setGames((data as Game[] | null) ?? []);
    };

    void load();

    // refresh after each finished game
    const onOver = () => {
      // give the DB trigger a beat, then re-read
      setTimeout(() => {
        if (!cancelled) void load();
      }, 250);
    };
    bridge.on("game:over", onOver);

    return () => {
      cancelled = true;
      bridge.off("game:over", onOver);
    };
  }, [user]);

  return games;
}
