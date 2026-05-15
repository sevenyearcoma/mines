"use client";

import Link from "next/link";
import { useMemo } from "react";
import { todayUtcDate } from "@/lib/engine";
import { useLeaderboard } from "@/lib/leaderboard/useLeaderboard";
import { flagEmoji } from "@/lib/leaderboard/country";
import { fmtTime } from "@/lib/format";

// Top-5 daily winners. Lives in the home-action-panel aside, replacing the
// hardcoded leaderboard. Falls back to a hint when no one has cleared the
// daily yet.
export function HomeLeaderboard() {
  const dateUtc = useMemo(() => todayUtcDate(), []);
  const { entries, loading } = useLeaderboard({
    tab: "daily",
    scope: "global",
    country: null,
    dateUtc,
  });
  const top = entries.slice(0, 5);

  return (
    <div className="home-leaderboard" aria-label="Lobby leaderboard">
      <div
        className="home-panel-label mono"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>fastest today</span>
        <Link
          href="/leaderboard"
          className="mono upper"
          style={{
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--gold)",
            textDecoration: "none",
          }}
        >
          all →
        </Link>
      </div>
      {loading && top.length === 0 ? (
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            padding: "10px 0",
          }}
        >
          loading…
        </div>
      ) : top.length === 0 ? (
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            padding: "10px 0",
            lineHeight: 1.4,
          }}
        >
          no winners yet today — be the first to clear it.
        </div>
      ) : (
        top.map((e) => {
          const inner = (
            <>
              <span className="mono">{e.rank}</span>
              <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {e.country && <span>{flagEmoji(e.country)}</span>}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.username}
                </span>
              </strong>
              <em>{fmtTime(Math.floor(e.value / 1000))}</em>
              <b />
            </>
          );
          if (e.demoId && e.demoKind) {
            return (
              <Link
                key={e.user_id}
                href={`/demo/${e.demoKind}/${e.demoId}`}
                className="home-rank-row"
                style={{ textDecoration: "none", cursor: "pointer" }}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div className="home-rank-row" key={e.user_id}>
              {inner}
            </div>
          );
        })
      )}
    </div>
  );
}
