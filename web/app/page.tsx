import Link from "next/link";
import { DailyPreviewBoard } from "@/components/home/DailyPreviewBoard";
import { HomeLeaderboard } from "@/components/home/HomeLeaderboard";
import { MascotScene } from "@/components/mascot/MascotScene";

const tableStats = [
  { label: "queue", value: "18s", tone: "gold" },
  { label: "tables", value: "42", tone: "green" },
  { label: "pot", value: "BO5", tone: "red" },
];

const modes = [
  {
    href: "/daily",
    label: "Daily challenge",
    meta: "one life, pure hardcore",
    className: "btn btn-red sparkle",
  },
  {
    href: "/play",
    label: "Solo sprint",
    meta: "warm-up table",
    className: "btn btn-gold",
  },
  {
    href: "/match",
    label: "Ranked BO5",
    meta: "shared seed duel",
    className: "btn btn-red",
  },
  {
    href: "/profile",
    label: "Profile",
    meta: "rating and history",
    className: "btn btn-ghost",
  },
];

export default function Home() {
  return (
    <main className="home-shell">
      <MascotScene pose="chipCount" caption="stack your chips, friend" />
      <section className="home-table" aria-label="Mines main table">
        <div className="home-copy">
          <div className="home-kicker mono">PvP beta table</div>
          <h1 className="home-title">
            <span className="wordmark" data-text="MINES">
              MINES
            </span>
            <span>duel house</span>
          </h1>
          <p className="home-subtitle">
            Fast boards, shared seeds, scoring pressure, and just enough casino
            heat to make every click feel expensive.
          </p>

          <div className="home-stat-row" aria-label="Live table stats">
            {tableStats.map((stat) => (
              <div className={`home-stat home-stat-${stat.tone}`} key={stat.label}>
                <span className="mono">{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <DailyPreviewBoard />

        <aside className="home-action-panel panel panel-gold">
          <div>
            <div className="home-panel-label mono">choose table</div>
            <h2>Play now</h2>
          </div>
          <div className="home-mode-list">
            {modes.map((mode) => (
              <Link href={mode.href} className={mode.className} key={mode.href}>
                <span>{mode.label}</span>
                <small>{mode.meta}</small>
              </Link>
            ))}
          </div>
          <div className="home-divider" />
          <HomeLeaderboard />
        </aside>
      </section>

      <section className="home-lower-grid" aria-label="Competitive rules">
        <article className="home-info-card">
          <span className="chip chip-gold">BO5</span>
          <h2>First to three</h2>
          <p>Short sets soften bad rolls without draining the tension.</p>
        </article>
        <article className="home-info-card">
          <span className="chip chip-green">16x16</span>
          <h2>Shared seed</h2>
          <p>Both players sit at the same table with the same opening.</p>
        </article>
        <article className="home-info-card">
          <span className="chip chip-red">score</span>
          <h2>Pressure pays</h2>
          <p>Base clears, combo, speed, and accuracy decide the round.</p>
        </article>
      </section>
    </main>
  );
}
