"use client";

import type { GameStats } from "@/game/bridge";
import type { Game } from "@/lib/types/db";
import { fmtTime } from "@/lib/format";

const placeholderRecents: [string, string, string, string][] = [
  ["WIN", "0:38", "+18", "#147"],
  ["WIN", "1:42", "+12", "#146"],
  ["BOOM", "2:11", "−24", "#145"],
  ["WIN", "1:17", "+9", "#144"],
  ["BOOM", "0:44", "−18", "#143"],
  ["WIN", "1:33", "+14", "#142"],
];

export function SidePanel({
  stats,
  recentGames,
}: {
  stats: GameStats;
  recentGames?: Game[] | null;
}) {
  const seconds = Math.floor(stats.elapsedMs / 1000);
  const bv = stats.opens > 0 && seconds > 0 ? (stats.opens / seconds).toFixed(2) : "0.00";
  const eff = stats.clicks > 0 ? Math.round((stats.opens / stats.clicks) * 100) : 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "20px 22px",
        borderLeft: "1.5px solid var(--line)",
        background: "rgba(0,0,0,.18)",
        overflow: "auto",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
          <div className="disp" style={{ fontSize: 22, fontWeight: 700 }}>
            this run
          </div>
          <div className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
            live
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Stat label="3bv/s" value={bv} />
          <Stat label="eff" value={`${eff}%`} />
          <Stat label="chains" value={stats.chains} />
          <Stat label="flags" value={stats.flagged} />
        </div>
      </div>

      <div className="div-label">recent</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {recentGames === null || recentGames === undefined
          ? placeholderRecents.map(([res, t, d, n], i) => (
              <div
                key={i}
                className="panel"
                style={{
                  padding: "8px 12px",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 10,
                  alignItems: "center",
                  opacity: 0.5,
                }}
              >
                <span className={"chip " + (res === "WIN" ? "chip-green" : "chip-red")}>{res}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>
                  {t}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: d.startsWith("+") ? "var(--green)" : "var(--red-glow)",
                  }}
                >
                  {d}
                </span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                  {n}
                </span>
              </div>
            ))
          : recentGames.length === 0
            ? (
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--ink-mute)", padding: 8 }}
              >
                no saved games yet.
              </div>
            )
            : recentGames.map((g) => (
                <div
                  key={g.id}
                  className="panel"
                  style={{
                    padding: "8px 12px",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <span className={"chip " + (g.won ? "chip-green" : "chip-red")}>
                    {g.won ? "WIN" : "BOOM"}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>
                    {fmtTime(Math.floor(g.elapsed_ms / 1000))}
                  </span>
                  <span
                    className="mono upper"
                    style={{ fontSize: 9, color: "var(--ink-mute)" }}
                  >
                    {g.difficulty.slice(0, 3)}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                    {g.opens}
                  </span>
                </div>
              ))}
      </div>

      <div className="div-label">how to</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.9 }}>
        <div>
          <span className="gold">L</span> reveal
        </div>
        <div>
          <span className="gold">R</span> flag
        </div>
        <div>
          <span className="gold">L+R</span> chord
        </div>
        <div>
          <span className="gold">SPC</span> new board
        </div>
        <div>
          <span className="gold">ESC</span> cancel auto-reset
        </div>
      </div>

      <div className="panel panel-gold" style={{ padding: 14, marginTop: 4 }}>
        <div className="mono upper" style={{ fontSize: 9, color: "var(--gold-glow)" }}>
          fair-deal proof
        </div>
        <div className="disp" style={{ fontSize: 14, marginTop: 4 }}>
          seed{" "}
          <span className="mono gold" style={{ fontSize: 12 }}>
            0x{stats.seed.toString(16).padStart(6, "0")}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 2 }}>
          server-dealt · verifiable post-game
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>
        {label}
      </div>
      <div className="disp gold" style={{ fontSize: 26, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}
