import Link from "next/link";

const previewCells = [
  "h",
  "h",
  "h",
  "f",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "r1",
  "r1",
  "r2",
  "h",
  "h",
  "r1",
  "r0",
  "r0",
  "h",
  "h",
  "r1",
  "r0",
  "r1",
  "r2",
  "h",
  "r1",
  "r0",
  "r1",
  "h",
  "h",
  "r2",
  "r1",
  "r1",
  "f",
  "h",
  "r2",
  "r1",
  "r2",
  "h",
  "h",
  "h",
  "r2",
  "r2",
  "r3",
  "h",
  "h",
  "r2",
  "f",
  "h",
  "h",
  "r1",
  "r0",
  "r0",
  "r2",
  "h",
  "r3",
  "h",
  "h",
  "h",
  "r2",
  "r1",
  "r0",
  "r0",
  "r1",
  "r2",
  "h",
  "r2",
  "h",
  "h",
  "r3",
  "h",
  "r2",
  "r1",
  "r0",
  "r1",
  "h",
  "h",
  "h",
  "m",
  "h",
  "r3",
  "f",
  "h",
  "r1",
  "r1",
  "h",
  "r2",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
  "h",
];

const tableStats = [
  { label: "queue", value: "18s", tone: "gold" },
  { label: "tables", value: "42", tone: "green" },
  { label: "pot", value: "BO5", tone: "red" },
];

const modes = [
  {
    href: "/play",
    label: "Solo sprint",
    meta: "warm-up table",
    className: "btn btn-gold sparkle",
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

const leaderboard = [
  { name: "vanta", score: "1842", streak: "+6" },
  { name: "rail", score: "1769", streak: "+3" },
  { name: "zero", score: "1711", streak: "+1" },
];

function cellLabel(cell: string) {
  if (cell === "h") return "";
  if (cell === "f") return "";
  if (cell === "m") return "";
  if (cell === "r0") return "";
  return cell.replace("r", "");
}

export default function Home() {
  return (
    <main className="home-shell">
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

        <div className="home-board-stage" aria-label="Mines board preview">
          <div className="home-board-top">
            <div>
              <span className="mono">table 07</span>
              <strong>rated race</strong>
            </div>
            <div className="home-clock mono">01:17</div>
          </div>
          <div className="home-board">
            {previewCells.map((cell, index) => (
              <span
                className={`home-cell home-cell-${cell}`}
                key={`${cell}-${index}`}
              >
                {cellLabel(cell)}
              </span>
            ))}
          </div>
          <div className="home-board-bottom">
            <span className="chip chip-green">safe streak 11</span>
            <span className="chip chip-red">mine odds rising</span>
          </div>
        </div>

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
          <div className="home-leaderboard" aria-label="Lobby leaderboard">
            <div className="home-panel-label mono">hot seats</div>
            {leaderboard.map((player, index) => (
              <div className="home-rank-row" key={player.name}>
                <span className="mono">{index + 1}</span>
                <strong>{player.name}</strong>
                <em>{player.score}</em>
                <b>{player.streak}</b>
              </div>
            ))}
          </div>
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
