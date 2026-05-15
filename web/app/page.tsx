import Link from "next/link";
import { DailyPreviewBoard } from "@/components/home/DailyPreviewBoard";
import { HomeLeaderboard } from "@/components/home/HomeLeaderboard";
import { MascotScene } from "@/components/mascot/MascotScene";

const tableStats = [
  { label: "queue", value: "18s", tone: "gold" },
  { label: "tables", value: "42", tone: "green" },
  { label: "pot", value: "BO5", tone: "red" },
];

// Secondary modes — styled as real cards (border + arrow + hover lift) so
// they read as clickable, while still sitting below the primary CTA.
const secondaryModes = [
  {
    href: "/daily",
    label: "Daily challenge",
    meta: "one life · pure hardcore",
    tone: "red" as const,
  },
  {
    href: "/match",
    label: "Ranked 1v1",
    meta: "shared seed duel",
    tone: "gold" as const,
  },
  {
    href: "/profile",
    label: "Profile",
    meta: "rating + history",
    tone: "neutral" as const,
  },
];

// Facts about the rules — informational, not actionable.
const rules = [
  { chip: "BO5", chipClass: "chip-gold", title: "First to three", body: "Short sets soften bad rolls without draining the tension." },
  { chip: "16×16", chipClass: "chip-green", title: "Shared seed", body: "Both players sit at the same table with the same opening." },
  { chip: "score", chipClass: "chip-red", title: "Pressure pays", body: "Base clears, combo, speed, and accuracy decide the round." },
];

export default function Home() {
  return (
    <main className="home-shell">
      <MascotScene pose="chipCount" caption="stack your chips, friend" />
      <section className="home-table" aria-label="Mines main table">
        {/* DOM order = column order: leaderboard (left), preview board (center), wordmark + CTA (right). */}
        <aside className="home-action-panel panel">
          <div>
            <div className="home-panel-label mono">live table</div>
            <h2>Top of the board</h2>
          </div>
          <HomeLeaderboard />
        </aside>

        <DailyPreviewBoard />

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

          {/* Single primary CTA — one click to play, no sign-in dance. */}
          <div className="home-primary-cta">
            <Link href="/play" className="btn btn-gold sparkle home-start-button">
              Start playing →
            </Link>
            <span className="home-primary-hint mono">
              no signup · jumps straight into a solo sprint
            </span>
          </div>

          <div className="home-stat-row" aria-label="Live table stats">
            {tableStats.map((stat) => (
              <div className={`home-stat home-stat-${stat.tone}`} key={stat.label}>
                <span className="mono">{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secondary entries — clearly clickable cards. */}
      <nav className="home-secondary-modes" aria-label="Other modes">
        {secondaryModes.map((mode) => (
          <Link
            href={mode.href}
            className={`home-secondary-link tone-${mode.tone}`}
            key={mode.href}
          >
            <div className="home-secondary-text">
              <span className="home-secondary-label">{mode.label}</span>
              <span className="home-secondary-meta mono">{mode.meta}</span>
            </div>
            <span className="home-secondary-arrow" aria-hidden>→</span>
          </Link>
        ))}
      </nav>

      {/* Rules — informational only, deliberately quieter than the cards above. */}
      <section className="home-rules" aria-label="Rules">
        {rules.map((rule) => (
          <article className="home-rule" key={rule.title}>
            <span className={`chip ${rule.chipClass}`}>{rule.chip}</span>
            <div className="home-rule-body">
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
