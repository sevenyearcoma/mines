// landing-screen.jsx — lobby with marquee hero + queue tiles + live ticker

function LandingScreen({ goto, settings }) {
  const tickerItems = [
    ["nightowl", "WIN",  "0:31", 18, "exp"],
    ["k4thy",    "WIN",  "0:34", 14, "int"],
    ["r3d",      "BOOM", "1:08", -22, "exp"],
    ["m4ds",     "WIN",  "1:42", 9, "int"],
    ["fr4nk",    "BOOM", "0:44", -18, "beg"],
    ["sw3ep",    "WIN",  "0:58", 12, "int"],
  ];

  const dailySpots = [
    ["nightowl", "0:31", 1, "#c97aff"],
    ["k4thy",    "0:34", 2, "#e3b248"],
    ["r3d",      "0:38", 3, "#e3b248"],
    ["m4ds",     "0:42", 4, "#c0c8d0"],
    ["fr4nk",    "0:45", 5, "#c0c8d0"],
  ];

  const eloTrend = [1100, 1132, 1145, 1170, 1162, 1190, 1215, 1198, 1230, 1247];

  return (
    <div className="screen scroll" style={{ height: "100vh", overflow: "auto" }}>
      {/* Hero */}
      <section style={{ padding: "60px 60px 40px", display: "grid", gridTemplateColumns: "1fr 480px", gap: 60, alignItems: "center", position: "relative", borderBottom: "1.5px solid var(--line)" }}>
        {/* glow */}
        <div style={{ position: "absolute", left: "10%", top: "10%", width: 480, height: 480, background: "radial-gradient(circle, rgba(227,178,72,.18), transparent 60%)", pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          <Tag tone="gold" style={{ marginBottom: 18 }}>
            <span>◆</span> season 4 · day #147
          </Tag>
          <h1 className="disp" style={{ fontSize: 132, margin: 0, lineHeight: 0.86, letterSpacing: "-0.03em", fontStyle: "italic" }}>
            <span className="foil">flip </span>
            <span className="foil-deep">it.</span>
            <br />
            <span style={{ color: "var(--ink)" }}>or </span>
            <span className="foil">flop </span>
            <span style={{ color: "var(--red-glow)", textShadow: "0 0 20px rgba(255,106,106,.4), 0 2px 0 #000" }}>out.</span>
          </h1>
          <p style={{ fontSize: 20, color: "var(--ink-2)", maxWidth: 540, marginTop: 24, lineHeight: 1.4 }}>
            Server-dealt minesweeper with the maths of probability, the juice of a slot machine, and the rating system of a chess club. No client-side cheating. No mercy.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 36, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-gold sparkle" onClick={() => goto("play")} style={{ fontSize: 22, padding: "16px 32px" }}>
              ▶ quick play
            </button>
            <button className="btn" onClick={() => goto("multi")} style={{ fontSize: 18 }}>
              find a race
            </button>
            <button className="btn btn-ghost" onClick={() => goto("daily")} style={{ fontSize: 16 }}>
              today's daily · #147
            </button>
          </div>
          <div style={{ display: "flex", gap: 28, marginTop: 32, color: "var(--ink-mute)" }}>
            <Stat n="18,442" l="online" />
            <Stat n="247k" l="games / 24h" />
            <Stat n="06:42:11" l="next daily" />
          </div>
        </div>

        {/* Right: stacked cards montage */}
        <div style={{ position: "relative", height: 480 }}>
          <FloatingCard x={140} y={70}  r={-12} val={3} delay={0} />
          <FloatingCard x={250} y={40}  r={4}   bomb delay={0.3} />
          <FloatingCard x={70}  y={180} r={-4}  val={1} delay={0.6} />
          <FloatingCard x={210} y={210} r={10}  val={2} delay={0.9} hidden />
          <FloatingCard x={130} y={310} r={-8}  flag delay={1.2} />
          <div style={{ position: "absolute", right: 20, bottom: 0, width: 260 }} className="panel panel-gold">
            <div style={{ padding: 14 }}>
              <div className="mono upper" style={{ fontSize: 9, color: "var(--gold-glow)" }}>now live</div>
              <div className="disp" style={{ fontSize: 18, marginTop: 2 }}>3 races in your range</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 6 }}>silver · int · bo3 · ~14s avg</div>
            </div>
          </div>
        </div>
      </section>

      {/* Three columns: queues, daily, ranking */}
      <section style={{ padding: "44px 60px", display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 26 }}>
        {/* Queues */}
        <div>
          <SectionH title="rated queues" sub="server-dealt · ranked" right={<Tag>42 players queued</Tag>} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["rated · beginner",     "~3s",  "88 q", "9×9 · 10",  false],
              ["rated · intermediate", "~14s", "42 q", "16×16 · 40", true],
              ["rated · expert",       "~22s", "18 q", "30×16 · 99", false],
              ["custom challenge",     "open", "—",    "any · invite", false],
            ].map(([t, w, q, sub, hot]) => (
              <button
                key={t}
                onClick={() => goto("play")}
                className={"panel" + (hot ? " panel-gold" : "")}
                style={{
                  padding: 16, textAlign: "left",
                  background: hot ? "linear-gradient(180deg, rgba(227,178,72,.15), var(--panel))" : undefined,
                  cursor: "pointer", border: "1.5px solid " + (hot ? "var(--gold-deep)" : "var(--line)"),
                  color: "var(--ink)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="disp" style={{ fontSize: 17, fontWeight: 700 }}>{t}</div>
                  {hot && <Tag tone="gold">hot</Tag>}
                </div>
                <div className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 6 }}>{sub}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12 }}>
                  <span className="mono ink2">{w} wait</span>
                  <span className="mono gold">{q}</span>
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <SectionH title="live races" sub="tap to spectate" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["nightowl", 1894, "k4thy", 1762, "0:24"],
                ["r3d",      1611, "fr4nk", 1556, "1:08"],
                ["sw3ep",    1490, "kn0x",  1444, "0:51"],
              ].map((g, i) => (
                <div key={i} className="panel" style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 60px 1fr 80px", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <Player name={g[0]} elo={g[1]} reverse />
                  <span className="disp" style={{ fontSize: 16, color: "var(--gold)", textAlign: "center", fontStyle: "italic" }}>vs</span>
                  <Player name={g[2]} elo={g[3]} />
                  <span className="mono" style={{ fontSize: 11, color: "var(--red-glow)", textAlign: "right" }}>● {g[4]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily card */}
        <div>
          <SectionH title="daily run" sub={`day #147 · resets in 06:42:11`} />
          <div className="panel panel-gold" style={{ padding: 20 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--gold-glow)" }}>same seed for everyone</div>
            <div className="disp" style={{ fontSize: 32, marginTop: 4, fontStyle: "italic" }}>your streak <span className="foil">×12</span></div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>
              best: 1:18 · rank #124 / 18,402 · top 0.7%
            </div>
            <div style={{ display: "flex", gap: 3, marginTop: 14, flexWrap: "wrap" }}>
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: i < 12 ? "linear-gradient(180deg, var(--green), var(--green-deep))"
                           : i < 16 ? "rgba(0,0,0,.4)"
                           : i < 19 ? "linear-gradient(180deg, var(--red-glow), var(--red))"
                           : "rgba(0,0,0,.4)",
                  border: "1px solid rgba(255,255,255,.06)",
                  boxShadow: i < 12 ? "0 0 4px rgba(76,175,106,.4)" : "none",
                }} />
              ))}
            </div>
            <button className="btn btn-gold" onClick={() => goto("daily")} style={{ width: "100%", marginTop: 16, fontSize: 18 }}>
              ▶ play today's
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginBottom: 6 }}>top 5 today</div>
            {dailySpots.map(([name, time, rk, color], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px dashed var(--line-soft)" }}>
                <span className="disp" style={{ fontSize: 16, color }}>{rk}</span>
                <span className="row">
                  <Avatar size={22} initials={name.slice(0,2).toUpperCase()} tint={color} />
                  <span style={{ fontSize: 14 }}>{name}</span>
                </span>
                <span className="mono gold" style={{ fontSize: 12 }}>{time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live ticker + you */}
        <div>
          <SectionH title="your rating" sub="silver · 14 wins from gold" />
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="disp foil" style={{ fontSize: 44, fontStyle: "italic", fontWeight: 800 }}>1247</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--green)" }}>+47 · 7d ▲</div>
            </div>
            <Sparkline data={eloTrend} w={260} h={36} color="var(--gold)" />
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <span>1100</span><span>now</span>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <SectionH title="live ticker" sub="last 30s" />
            <div className="panel" style={{ padding: 14 }}>
              {tickerItems.map((t, i) => (
                <TickerLine key={i} name={t[0]} action={t[1]} time={t[2]} delta={t[3]} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "40px 60px 80px", borderTop: "1.5px solid var(--line)", background: "linear-gradient(180deg, transparent, rgba(0,0,0,.2))" }}>
        <SectionH title="how MINES works" sub="four rules · no patterns to memorize" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 8 }}>
          {[
            ["01", "server deals", "every board generated server-side. seed + hash visible. nobody peeks ahead."],
            ["02", "first click safe", "you'll never lose on click 1. promise."],
            ["03", "rated ladder", "win → elo up. boom → elo down. plate → neon over six tiers."],
            ["04", "auto-reset on", "lose, count down 3, deal again. esc cancels. flow state preserved."],
          ].map(([n, t, d]) => (
            <div key={n} className="panel" style={{ padding: 18 }}>
              <div className="disp foil" style={{ fontSize: 34, fontStyle: "italic", fontWeight: 800 }}>{n}</div>
              <div className="disp" style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{t}</div>
              <div className="ink2" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div className="disp gold" style={{ fontSize: 24, fontWeight: 700, fontStyle: "italic" }}>{n}</div>
      <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 2 }}>{l}</div>
    </div>
  );
}

function Player({ name, elo, reverse }) {
  return (
    <div style={{ display: "flex", flexDirection: reverse ? "row-reverse" : "row", alignItems: "center", gap: 8 }}>
      <Avatar size={26} initials={name.slice(0, 2).toUpperCase()} tint="#7a4a2c" />
      <div style={{ textAlign: reverse ? "right" : "left" }}>
        <div className="disp" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>{name}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{elo}</div>
      </div>
    </div>
  );
}

// Decorative floating card on hero
function FloatingCard({ x, y, r = 0, val, bomb, flag, hidden, delay = 0 }) {
  const w = 70, h = 92;
  return (
    <div
      style={{
        position: "absolute", left: x, top: y,
        width: w, height: h,
        transform: `rotate(${r}deg)`,
        animation: `float-y 3s ease-in-out ${delay}s infinite`,
        filter: "drop-shadow(0 8px 16px rgba(0,0,0,.6))",
      }}
    >
      <div style={{
        width: "100%", height: "100%",
        background: hidden
          ? "linear-gradient(135deg, #8a1f1f 0%, #d63b3b 50%, #8a1f1f 100%)"
          : "linear-gradient(180deg, var(--tile-face), var(--tile-face-2))",
        border: "2px solid #00000088",
        borderRadius: 8,
        boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.3), inset 0 -2px 0 rgba(0,0,0,.4)",
        display: "grid", placeItems: "center",
        position: "relative",
      }}>
        {hidden && (
          <div style={{
            width: "70%", height: "70%",
            border: "1.5px solid rgba(255,212,114,.5)",
            borderRadius: 4,
            display: "grid", placeItems: "center",
          }}>
            <div className="disp" style={{ fontSize: 30, color: "var(--gold-glow)", fontStyle: "italic", textShadow: "0 0 8px var(--gold-glow)" }}>★</div>
          </div>
        )}
        {!hidden && val !== undefined && !bomb && !flag && (
          <div className={"num n" + val} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 50, filter: "drop-shadow(0 0 6px currentColor)" }}>{val}</div>
        )}
        {bomb && (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0a0a0a", boxShadow: "inset 3px 3px 0 rgba(255,255,255,.3), inset -3px -3px 0 rgba(0,0,0,.6), 0 0 14px rgba(255,80,80,.7)" }} />
        )}
        {flag && (
          <div style={{ width: 36, height: 36, background: "var(--red)", clipPath: "polygon(0 0, 100% 22%, 0 44%, 0 100%, 12% 100%, 12% 0)" }} />
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LandingScreen });
