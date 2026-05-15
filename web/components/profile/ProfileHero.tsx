import { fmtTime } from "@/lib/format";
import { flagEmoji, countryName } from "@/lib/leaderboard/country";
import type { Profile } from "@/lib/types/db";

function bestTimeAcross(profile: Profile | null): {
  ms: number;
  difficulty: "beginner" | "intermediate" | "expert";
} | null {
  if (!profile) return null;
  const candidates: Array<{
    ms: number | null | undefined;
    difficulty: "beginner" | "intermediate" | "expert";
  }> = [
    { ms: profile.best_time_beginner_ms, difficulty: "beginner" },
    { ms: profile.best_time_intermediate_ms, difficulty: "intermediate" },
    { ms: profile.best_time_expert_ms, difficulty: "expert" },
  ];
  const valid = candidates.filter(
    (c): c is { ms: number; difficulty: typeof c.difficulty } =>
      typeof c.ms === "number" && c.ms > 0,
  );
  if (valid.length === 0) return null;
  return valid.reduce((best, cur) => (cur.ms < best.ms ? cur : best));
}

export function ProfileHero({ profile }: { profile: Profile | null }) {
  const username = profile?.username ?? "player";
  const country = profile?.country ?? null;
  const best = bestTimeAcross(profile);
  const bestSeconds = best ? Math.floor(best.ms / 1000) : null;
  const wins = profile?.games_won ?? 0;
  const streak = profile?.current_streak ?? 0;

  return (
    <header
      className="profile-hero"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
        gap: 24,
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          justifyContent: "center",
          minWidth: 0,
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "var(--gold)",
            letterSpacing: "0.3em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {country && (
            <span title={countryName(country)} style={{ fontSize: 14 }}>
              {flagEmoji(country)}
            </span>
          )}
          <span>player profile</span>
        </div>
        <div
          className="wordmark"
          data-text={username}
          style={{
            fontSize: "clamp(48px, 6vw, 78px)",
            lineHeight: 0.95,
            letterSpacing: "0.01em",
            fontStyle: "italic",
          }}
        >
          {username}
        </div>
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "var(--ink-mute)",
            letterSpacing: "0.22em",
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <span>
            {profile?.games_played ?? 0} games · {wins} wins
          </span>
          {streak > 0 && (
            <span className="glow-gold" style={{ color: "var(--gold)" }}>
              streak {streak}
            </span>
          )}
        </div>
      </div>

      <aside
        className="panel panel-gold"
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "var(--gold)",
            letterSpacing: "0.28em",
          }}
        >
          best run
        </div>
        <div
          className="disp glow-gold"
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "var(--gold-glow)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {bestSeconds !== null ? fmtTime(bestSeconds) : "—"}
        </div>
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "var(--ink-mute)",
            letterSpacing: "0.22em",
          }}
        >
          {best ? best.difficulty : "no clean wins yet"}
        </div>
      </aside>
    </header>
  );
}
