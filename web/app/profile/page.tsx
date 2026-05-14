import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Game, Profile } from "@/lib/types/db";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return fmtTime(Math.floor(ms / 1000));
}

export default async function ProfilePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/profile");

  const [profileRes, gamesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("games")
      .select("*")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(20),
  ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const games = (gamesRes.data as Game[] | null) ?? [];

  const played = profile?.games_played ?? 0;
  const won = profile?.games_won ?? 0;
  const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "32px 28px 48px",
        maxWidth: 920,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div
          className="disp"
          style={{ fontSize: 42, fontStyle: "italic", letterSpacing: "-0.02em" }}
        >
          {profile?.username ?? "player"}
        </div>
        <div
          className="mono upper"
          style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.3em" }}
        >
          profile
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        <Stat label="games" value={played} />
        <Stat label="wins" value={won} />
        <Stat label="win rate" value={`${winRate}%`} />
        <Stat label="best streak" value={profile?.best_streak ?? 0} />
      </section>

      <section>
        <div className="div-label" style={{ marginBottom: 10 }}>
          best times
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}
        >
          <Stat label="beginner" value={fmtMs(profile?.best_time_beginner_ms)} />
          <Stat
            label="intermediate"
            value={fmtMs(profile?.best_time_intermediate_ms)}
          />
          <Stat label="expert" value={fmtMs(profile?.best_time_expert_ms)} />
        </div>
      </section>

      <section>
        <div className="div-label" style={{ marginBottom: 10 }}>
          recent games
        </div>
        {games.length === 0 ? (
          <div
            className="mono"
            style={{ fontSize: 12, color: "var(--ink-mute)", padding: 12 }}
          >
            no games yet — play one and come back.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {games.map((g) => (
              <div
                key={g.id}
                className="panel"
                style={{
                  padding: "10px 14px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span
                  className={"chip " + (g.won ? "chip-green" : "chip-red")}
                >
                  {g.won ? "WIN" : "BOOM"}
                </span>
                <span
                  className="mono upper"
                  style={{ fontSize: 10, color: "var(--ink-mute)" }}
                >
                  {g.difficulty}
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>
                  {fmtMs(g.elapsed_ms)}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--ink-mute)" }}
                >
                  {g.opens} opens
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "var(--ink-mute)" }}
                  title={new Date(g.played_at).toLocaleString()}
                >
                  {new Date(g.played_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>
        {label}
      </div>
      <div
        className="disp gold"
        style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}
