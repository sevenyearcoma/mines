import { fmtTime } from "@/lib/format";
import type { Profile } from "@/lib/types/db";

function fmtMs(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "—";
  return fmtTime(Math.floor(ms / 1000));
}

export function StatsTriptych({ profile }: { profile: Profile | null }) {
  const played = profile?.games_played ?? 0;
  const won = profile?.games_won ?? 0;
  const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
  const current = profile?.current_streak ?? 0;
  const best = profile?.best_streak ?? 0;
  const streakPct = best > 0 ? Math.min(100, Math.round((current / best) * 100)) : 0;

  return (
    <section
      className="profile-triptych"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      <article
        className="panel-felt"
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "rgba(180, 230, 200, 0.85)",
            letterSpacing: "0.28em",
          }}
        >
          volume
        </div>
        <div>
          <div
            className="hud-value"
            style={{
              color: "var(--green)",
              textShadow:
                "0 0 16px rgba(76,175,106,.45), 0 1px 0 #000",
              fontSize: 56,
            }}
          >
            {winRate}%
          </div>
          <div
            className="mono upper"
            style={{
              fontSize: 9,
              letterSpacing: "0.24em",
              color: "rgba(180, 230, 200, 0.7)",
            }}
          >
            win rate
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 4,
          }}
        >
          <MiniStat label="games" value={played} />
          <MiniStat label="wins" value={won} />
        </div>
      </article>

      <article
        className="panel"
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
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
          speed
        </div>
        <SpeedRow label="beginner" value={fmtMs(profile?.best_time_beginner_ms)} />
        <SpeedRow
          label="intermediate"
          value={fmtMs(profile?.best_time_intermediate_ms)}
        />
        <SpeedRow label="expert" value={fmtMs(profile?.best_time_expert_ms)} />
      </article>

      <article
        className="panel-velvet"
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          className="mono upper"
          style={{
            fontSize: 10,
            color: "rgba(220, 190, 255, 0.85)",
            letterSpacing: "0.28em",
          }}
        >
          streak
        </div>
        <div>
          <div
            className="hud-value"
            style={{
              color: "#e3b2ff",
              textShadow:
                "0 0 16px rgba(190, 130, 255, 0.55), 0 1px 0 #000",
              fontSize: 56,
            }}
          >
            {current}
          </div>
          <div
            className="mono upper"
            style={{
              fontSize: 9,
              letterSpacing: "0.24em",
              color: "rgba(220, 190, 255, 0.7)",
            }}
          >
            current
          </div>
        </div>
        <div className="streak-meter" style={{ height: 8 }}>
          <div
            className="streak-fill"
            style={{
              width: `${streakPct}%`,
            }}
          />
        </div>
        <div
          className="mono upper"
          style={{
            fontSize: 9,
            color: "rgba(220, 190, 255, 0.7)",
            letterSpacing: "0.22em",
          }}
        >
          best {best}
        </div>
      </article>
    </section>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div
        className="mono upper"
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: "rgba(180, 230, 200, 0.7)",
        }}
      >
        {label}
      </div>
      <div
        className="disp"
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SpeedRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 14,
        borderBottom: "1px dashed var(--line-soft)",
        paddingBottom: 8,
      }}
    >
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          color: "var(--ink-mute)",
          letterSpacing: "0.22em",
        }}
      >
        {label}
      </div>
      <div
        className="disp gold"
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "var(--gold-glow)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
