"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type LeaderboardScope = "global" | "region";
export type LeaderboardTab = "daily" | "wins" | "best_time";

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  country: string | null;
  // tab-specific value, already formatted as a number:
  // daily / best_time → ms
  // wins → count
  value: number;
  // extra context shown in the row
  context?: string;
  // Demo id for click-through playback. Only set on the daily tab (where the
  // row maps 1:1 to a recorded run). Other tabs aggregate across many runs,
  // so they don't have a single demo to point at.
  demoId?: string;
  demoKind?: "solo" | "daily";
}

interface RawDailyRow {
  id: string;
  user_id: string;
  elapsed_ms: number;
  opens: number;
  clicks: number;
  played_at: string;
  profiles: { username: string; country: string | null } | null;
}

interface RawProfileRow {
  id: string;
  username: string;
  country: string | null;
  games_won: number;
  games_played: number;
  best_streak: number;
  best_time_intermediate_ms: number | null;
}

const MAX_ROWS = 50;

// Pulls a leaderboard slice. Re-fetches whenever the tab / scope / country
// changes. Region scope is a hard filter on profile.country; global means no
// country filter.
export function useLeaderboard({
  tab,
  scope,
  country,
  dateUtc,
}: {
  tab: LeaderboardTab;
  scope: LeaderboardScope;
  country: string | null;
  dateUtc: string;
}): { entries: LeaderboardEntry[]; loading: boolean; error: string | null } {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const supabase = getBrowserSupabase();
      const regionFilter =
        scope === "region" && country
          ? country
          : null;

      try {
        if (tab === "daily") {
          // Today's daily winners, fastest first.
          let q = supabase
            .from("daily_completions")
            .select(
              "id, user_id, elapsed_ms, opens, clicks, played_at, profiles:profiles!inner(username, country)",
            )
            .eq("date", dateUtc)
            .eq("won", true)
            .order("elapsed_ms", { ascending: true })
            .limit(MAX_ROWS);
          if (regionFilter) {
            q = q.eq("profiles.country", regionFilter);
          }
          const { data, error } = await q;
          if (error) throw error;
          if (cancelled) return;
          const rows = ((data as unknown) as RawDailyRow[]) ?? [];
          setEntries(
            rows.map((r, i) => ({
              rank: i + 1,
              user_id: r.user_id,
              username: r.profiles?.username ?? "player",
              country: r.profiles?.country ?? null,
              value: r.elapsed_ms,
              context: `${r.opens} opens`,
              demoId: r.id,
              demoKind: "daily",
            })),
          );
        } else {
          // All-time tabs read directly from profiles.
          const orderCol =
            tab === "wins" ? "games_won" : "best_time_intermediate_ms";
          const ascending = tab === "best_time";
          let q = supabase
            .from("profiles")
            .select(
              "id, username, country, games_won, games_played, best_streak, best_time_intermediate_ms",
            )
            .order(orderCol, { ascending, nullsFirst: false })
            .limit(MAX_ROWS);
          if (tab === "wins") {
            q = q.gt("games_won", 0);
          } else {
            q = q.not("best_time_intermediate_ms", "is", null);
          }
          if (regionFilter) {
            q = q.eq("country", regionFilter);
          }
          const { data, error } = await q;
          if (error) throw error;
          if (cancelled) return;
          const rows = ((data as unknown) as RawProfileRow[]) ?? [];
          setEntries(
            rows.map((r, i) => {
              if (tab === "wins") {
                const wr =
                  r.games_played > 0
                    ? Math.round((r.games_won / r.games_played) * 100)
                    : 0;
                return {
                  rank: i + 1,
                  user_id: r.id,
                  username: r.username,
                  country: r.country,
                  value: r.games_won,
                  context: `${wr}% win rate`,
                };
              }
              return {
                rank: i + 1,
                user_id: r.id,
                username: r.username,
                country: r.country,
                value: r.best_time_intermediate_ms ?? 0,
                context: `best streak ${r.best_streak}`,
              };
            }),
          );
        }
      } catch (err) {
        if (cancelled) return;
        // Supabase throws PostgrestError objects, not Error instances. Pull
        // their .message so the UI surfaces an actionable reason (e.g.
        // "Could not find a relationship between ...") instead of a vague
        // fallback.
        const msg =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to load leaderboard";
        console.error("[leaderboard] query failed:", err);
        setError(msg);
        setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, scope, country, dateUtc]);

  return { entries, loading, error };
}

// Pulls the distinct set of country codes that actually appear in the data
// the leaderboard surfaces — drives the picker dropdown so we don't show
// countries that have no players yet.
export function useSeenCountries(): { codes: string[]; loading: boolean } {
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("profiles")
        .select("country")
        .not("country", "is", null)
        .limit(500);
      if (cancelled) return;
      const set = new Set<string>();
      for (const row of ((data as unknown) as { country: string }[]) ?? []) {
        if (row.country) set.add(row.country);
      }
      setCodes([...set]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { codes, loading };
}
