// other-screens.jsx — Daily, Leaderboards, Profile, Settings, Multiplayer (mocked but rich)

// ─── Daily Challenge ─────────────────────────────────────────────
function DailyScreen({ goto }) {
  const top = [
    ["nightowl", "0:31", 1, "neon"],
    ["k4thy",    "0:34", 2, "gold"],
    ["r3d",      "0:38", 3, "gold"],
    ["m4ds",     "0:42", 4, "silver"],
    ["fr4nk",    "0:45", 5, "silver"],
    ["sw3ep",    "0:48", 6, "copper"],
    ["kn0x",     "0:51", 7, "copper"],
    ["zo3",      "0:55", 8, "copper"],
    ["pix",      "0:58", 9, "plate"],
    ["b3lle",    "1:01", 10,"plate"],
  ];
  const tierColors = { neon: "#c97aff", gold: "#e3b248", silver: "#c0c8d0", copper: "#b07a4a", plate: "#b8a78a" };
  return (
    <div className="screen scroll" style={{ height: "100vh", overflow: "auto", padding: "40px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <Tag tone="gold">day #147 · 13 may 2026</Tag>
          <h1 className="disp" style={{ fontSize: 78, margin: "10px 0 0", lineHeight: .9, fontStyle: "italic" }}>
            <span className="foil">daily</span> <span style={{ color: "var(--ink)" }}>run</span>
          </h1>
          <p className="ink2" style={{ fontSize: 16, maxWidth: 480, marginTop: 8 }}>
            Same seed for the whole world. One attempt per difficulty. Resets in <span className="gold mono">06:42:11</span>.
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 240 }} />
        <div className="panel panel-gold" style={{ padding: 16, minWidth: 220 }}>
          <div className="mono upper" style={{ fontSize: 9, color: "var(--gold-glow)" }}>your streak</div>
          <div className="disp foil" style={{ fontSize: 56, fontWeight: 800, fontStyle: "italic", lineHeight: 1 }}>×12</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>best · ×23 · 4 days ago</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 30, marginTop: 30 }}>
        {/* Difficulty cards */}
        <div>
          <SectionH title="pick your difficulty" sub="1 attempt each · today only" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[
              ["beginner",     "9×9 · 10",   "0:34", "#412",  "completed", "#142"],
              ["intermediate", "16×16 · 40", "1:18", "#124",  "completed", null],
              ["expert",       "30×16 · 99", "—",    "—",     "untouched", null],
            ].map(([d, sz, best, rank, status]) => {
              const done = status === "completed";
              return (
                <div key={d} className={done ? "panel" : "panel panel-gold"} style={{ padding: 18, position: "relative", overflow: "hidden" }}>
                  {!done && (
                    <div style={{ position: "absolute", top: 12, right: 12 }}>
                      <Tag tone="gold">play me</Tag>
                    </div>
                  )}
                  <div className="disp" style={{ fontSize: 28, fontStyle: "italic", fontWeight: 800 }}>
                    {d}
                  </div>
                  <div className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{sz}</div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                    <div>
                      <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>your time</div>
                      <div className="disp" style={{ fontSize: 26, fontWeight: 700, color: done ? "var(--ink-2)" : "var(--gold-glow)" }}>{best}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>global rank</div>
                      <div className="disp" style={{ fontSize: 26, fontWeight: 700, color: done ? "var(--ink-2)" : "var(--gold-glow)" }}>{rank}</div>
                    </div>
                  </div>
                  <button
                    className={done ? "btn btn-ghost" : "btn btn-gold sparkle"}
                    onClick={() => goto("play")}
                    disabled={done}
                    style={{ width: "100%", marginTop: 14, opacity: done ? .55 : 1, cursor: done ? "not-allowed" : "pointer" }}
                  >
                    {done ? "✓ played" : `▶ ${d.slice(0,3)}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 26 }}>
            <SectionH title="streak calendar" sub="last 28 days · ● won  ○ skipped  ✕ failed" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 6 }}>
              {Array.from({ length: 28 }).map((_, i) => {
                const v = i < 12 ? "won" : i < 16 ? "skip" : i < 19 ? "fail" : "skip";
                const bg = v === "won" ? "linear-gradient(180deg, var(--green), var(--green-deep))"
                         : v === "fail" ? "linear-gradient(180deg, var(--red-glow), var(--red))"
                         : "rgba(0,0,0,.3)";
                return (
                  <div key={i} className="panel" style={{ aspectRatio: "1/1", padding: 0, display: "grid", placeItems: "center", background: bg, border: "1px solid var(--line-soft)", boxShadow: v === "won" ? "0 0 6px rgba(76,175,106,.4)" : "none" }}>
                    <div className="mono" style={{ fontSize: 10, color: v === "skip" ? "var(--ink-mute)" : "#fff", fontWeight: 600 }}>{120 + i}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Leaderboard side */}
        <div>
          <SectionH title="today's top 10" sub="intermediate · global" />
          <div className="panel" style={{ padding: 14 }}>
            {top.map(([name, time, rk, tier], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "30px 1fr auto auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: i === top.length - 1 ? "none" : "1px dashed var(--line-soft)" }}>
                <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: rk <= 3 ? "var(--gold-glow)" : "var(--ink-mute)", fontStyle: "italic" }}>{rk}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar size={28} initials={name.slice(0,2).toUpperCase()} tint={tierColors[tier]} />
                  <div>
                    <div className="disp" style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
                    <div className="mono upper" style={{ fontSize: 9, color: tierColors[tier], letterSpacing: ".16em" }}>{tier}</div>
                  </div>
                </div>
                <div className="mono gold" style={{ fontSize: 14, fontWeight: 600 }}>{time}</div>
                <div style={{ width: 30 }}>
                  {i === 0 && <span style={{ fontSize: 16 }}>👑</span>}
                </div>
              </div>
            ))}
            {/* your row */}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "30px 1fr auto auto", gap: 12, alignItems: "center", padding: "10px 12px", background: "linear-gradient(90deg, rgba(227,178,72,.18), transparent 80%)", border: "1.5px solid var(--gold-deep)", borderRadius: 6 }}>
              <div className="disp foil" style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>124</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar size={28} initials="PL" tint="#5b9eff" />
                <div>
                  <div className="disp" style={{ fontSize: 15, fontWeight: 600 }}>you</div>
                  <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>silver · top 0.7%</div>
                </div>
              </div>
              <div className="mono gold" style={{ fontSize: 14, fontWeight: 600 }}>1:18</div>
              <div style={{ width: 30 }} />
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16, padding: 14 }}>
            <SectionH title="by city" sub="алматы · top 5" />
            {[["a.zhumagulov", "0:42", "neon"], ["bekzhan", "0:48", "gold"], ["aigerim_k", "0:52", "gold"], ["nurzhan", "1:01", "silver"], ["you", "1:18", "silver"]].map(([n, t, tier], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: i === 4 ? "none" : "1px dashed var(--line-soft)" }}>
                <span className="disp" style={{ fontSize: 13, color: "var(--ink-mute)" }}>{i+1}</span>
                <span className="disp" style={{ fontSize: 14, color: n === "you" ? "var(--gold-glow)" : "var(--ink)", fontWeight: n === "you" ? 700 : 500 }}>{n}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--gold)" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboards ─────────────────────────────────────────────
function LeaderboardScreen() {
  const tiers = [
    ["neon",   "1800+",     "#c97aff"],
    ["ruby",   "1600–1799", "#d63b3b"],
    ["gold",   "1400–1599", "#e3b248"],
    ["silver", "1200–1399", "#c0c8d0"],
    ["copper", "1000–1199", "#b07a4a"],
    ["plate",  "0–999",     "#b8a78a"],
  ];
  const rows = [
    [1, "nightowl", 2104, "0:31", 47, "neon",   [3,5,4,7,6,9,11,12,14,16]],
    [2, "k4thy",    1894, "0:34", 39, "neon",   [2,3,4,6,8,7,10,11,13,15]],
    [3, "r3d",      1762, "0:38", 33, "ruby",   [5,4,6,5,7,8,9,11,12,14]],
    [4, "m4ds",     1701, "0:42", 28, "ruby",   [3,4,3,5,6,7,8,10,11,13]],
    [5, "fr4nk",    1644, "0:45", 22, "ruby",   [1,3,2,4,5,6,7,9,10,12]],
    [6, "sw3ep",    1611, "0:48", 19, "ruby",   [2,2,3,4,5,5,7,8,10,11]],
    [7, "kn0x",     1556, "0:51", 17, "gold",   [3,2,3,4,4,6,7,8,9,11]],
    [8, "zo3",      1503, "0:55", 12, "gold",   [4,3,3,2,4,5,6,7,8,10]],
    [9, "pix",      1488, "0:58", 11, "gold",   [2,3,2,3,4,5,6,7,8,9]],
    [10,"b3lle",    1461, "1:01", 9,  "gold",   [1,2,2,3,3,4,5,6,7,8]],
  ];
  const tierColors = { neon: "#c97aff", gold: "#e3b248", silver: "#c0c8d0", copper: "#b07a4a", plate: "#b8a78a", ruby: "#d63b3b" };

  return (
    <div className="screen scroll" style={{ height: "100vh", overflow: "auto", padding: "40px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
        <div>
          <Tag tone="gold">season 4 · 11 days left</Tag>
          <h1 className="disp" style={{ fontSize: 78, margin: "10px 0 4px", fontStyle: "italic" }}>
            <span className="foil">ranked</span> <span style={{ color: "var(--ink)" }}>ladder</span>
          </h1>
          <div className="ink2">resets every 30 days · top 3% promote one tier</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
        {["global", "friends", "country", "all-time"].map((t, i) => (
          <button key={t} className={i === 0 ? "btn btn-gold" : "btn btn-ghost"} style={{ padding: "8px 14px", fontSize: 14 }}>{t}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(0,0,0,.4)", border: "1px solid var(--line-soft)", borderRadius: 6 }}>
          {["expert", "intermediate", "beginner"].map((d, i) => (
            <button key={d} className="mono upper" style={{
              fontSize: 10, padding: "6px 14px", letterSpacing: "0.16em",
              background: i === 1 ? "linear-gradient(180deg, var(--gold-glow), var(--gold))" : "transparent",
              color: i === 1 ? "#2a1d04" : "var(--ink-2)",
              border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700,
            }}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 30, marginTop: 24 }}>
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 90px 90px 90px 140px", padding: "10px 16px", borderBottom: "1.5px solid var(--line)", background: "rgba(0,0,0,.3)" }}>
            {["#", "player", "elo", "best", "streak", "trend"].map((h, i) => (
              <div key={i} className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.2em" }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r[0]} style={{
              display: "grid", gridTemplateColumns: "60px 1fr 90px 90px 90px 140px",
              padding: "12px 16px",
              borderBottom: "1px solid var(--line-soft)",
              background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,.15)",
              alignItems: "center",
            }}>
              <div className="disp" style={{ fontSize: 20, fontWeight: 800, fontStyle: "italic", color: r[0] <= 3 ? "var(--gold-glow)" : "var(--ink-2)" }}>
                {r[0] === 1 ? "👑 1" : r[0]}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar size={30} initials={r[1].slice(0,2).toUpperCase()} tint={tierColors[r[5]]} />
                <div>
                  <div className="disp" style={{ fontSize: 16, fontWeight: 700 }}>{r[1]}</div>
                  <div className="mono upper" style={{ fontSize: 9, color: tierColors[r[5]] }}>{r[5]}</div>
                </div>
              </div>
              <div className="disp gold" style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>{r[2]}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--ink-2)" }}>{r[3]}</div>
              <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>×{r[4]}</div>
              <Sparkline data={r[6]} w={120} h={26} color="var(--green)" />
            </div>
          ))}

          <div style={{
            display: "grid", gridTemplateColumns: "60px 1fr 90px 90px 90px 140px",
            padding: "14px 16px",
            background: "linear-gradient(90deg, rgba(227,178,72,.20), transparent 80%)",
            borderTop: "2px solid var(--gold-deep)",
            alignItems: "center",
          }}>
            <div className="disp foil" style={{ fontSize: 22, fontWeight: 800, fontStyle: "italic" }}>247</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar size={32} initials="PL" tint="#5b9eff" />
              <div>
                <div className="disp" style={{ fontSize: 17, fontWeight: 700 }}>you</div>
                <div className="mono upper" style={{ fontSize: 9, color: tierColors.silver }}>silver</div>
              </div>
            </div>
            <div className="disp foil" style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>1247</div>
            <div className="mono" style={{ fontSize: 13, color: "var(--ink-2)" }}>1:18</div>
            <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>×3</div>
            <Sparkline data={[3,3,2,4,5,4,5,7,8,9]} w={120} h={26} color="var(--gold)" />
          </div>
        </div>

        <div>
          <SectionH title="tiers" sub="seasonal · soft reset" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tiers.map(([n, range, c]) => (
              <div key={n} className={n === "silver" ? "panel panel-gold" : "panel"} style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, borderColor: n === "silver" ? "var(--gold-deep)" : undefined }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: `radial-gradient(circle at 30% 30%, ${c}, ${c}55 60%, ${c}22)`, border: `1px solid ${c}`, boxShadow: `0 0 10px ${c}55`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="disp" style={{ fontSize: 16, fontWeight: 700, textTransform: "capitalize", color: c }}>{n}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{range}</div>
                </div>
                {n === "silver" && <Tag tone="gold">you</Tag>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────
function ProfileScreen() {
  return (
    <div className="screen scroll" style={{ height: "100vh", overflow: "auto", padding: "40px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
        <Avatar size={120} initials="PL" tint="#5b9eff" />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="disp" style={{ fontSize: 56, margin: 0, fontStyle: "italic" }}>player_one</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
            <RankBadge tier="silver" elo={1247} />
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-mute)" }}>· joined dec '25 · sf, ca · алматы</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-gold">challenge</button>
          <button className="btn">add friend</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, marginTop: 16, borderBottom: "1.5px solid var(--line)" }}>
        {["overview", "games", "stats", "trophies"].map((t, i) => (
          <div key={t} className="disp" style={{
            fontSize: 18, fontWeight: i === 0 ? 700 : 500,
            color: i === 0 ? "var(--gold-glow)" : "var(--ink-mute)",
            padding: "12px 4px", cursor: "pointer",
            borderBottom: i === 0 ? "2px solid var(--gold)" : "2px solid transparent",
            fontStyle: "italic",
          }}>{t}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 22 }}>
        {[["win rate", "63%", "342W / 198L", "var(--green)"], ["best · int", "1:18", "top 0.7%", "var(--gold-glow)"], ["streak", "×3", "best ×12", "var(--ink)"], ["3bv/s peak", "2.84", "expert avg", "var(--gold)"]].map(([l, v, s, c]) => (
          <div key={l} className="panel" style={{ padding: 18 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>{l}</div>
            <div className="disp" style={{ fontSize: 44, fontWeight: 800, fontStyle: "italic", color: c, marginTop: 2 }}>{v}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <div className="panel" style={{ padding: 20 }}>
          <SectionH title="elo trajectory" sub="last 90 days · 1100 → 1247" />
          <svg width="100%" height="160" viewBox="0 0 500 160" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gradElo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e3b248" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#e3b248" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 120 L40 116 L80 110 L120 112 L160 100 L200 102 L240 90 L280 86 L320 70 L360 62 L400 50 L440 40 L500 28" stroke="var(--gold-glow)" strokeWidth="2" fill="none" filter="drop-shadow(0 0 4px var(--gold))" />
            <path d="M0 120 L40 116 L80 110 L120 112 L160 100 L200 102 L240 90 L280 86 L320 70 L360 62 L400 50 L440 40 L500 28 L500 160 L0 160 Z" fill="url(#gradElo)" />
            <line x1="0" y1="140" x2="500" y2="140" stroke="var(--line-soft)" strokeDasharray="3 3" />
          </svg>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <SectionH title="recent history" sub="last 6 games" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["WIN",  "vs k4thy", "1:42", 18],
              ["WIN",  "vs r3d",   "0:58", 12],
              ["BOOM", "vs m4ds",  "2:11", -24],
              ["WIN",  "vs fr4nk", "1:17", 9],
              ["BOOM", "vs sw3ep", "0:44", -18],
              ["WIN",  "vs kn0x",  "1:33", 14],
            ].map(([res, opp, t, d], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto auto", gap: 10, alignItems: "center", padding: "8px 4px", borderBottom: "1px dashed var(--line-soft)" }}>
                <Tag tone={res === "WIN" ? "green" : "red"}>{res}</Tag>
                <span className="disp" style={{ fontSize: 14 }}>{opp}</span>
                <span className="mono" style={{ fontSize: 12 }}>{t}</span>
                <span className="mono" style={{ fontSize: 12, color: d > 0 ? "var(--green)" : "var(--red-glow)", fontWeight: 700 }}>{d > 0 ? "+" : ""}{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 20, marginTop: 18 }}>
        <SectionH title="play heatmap" sub="last 365 days · 412 games" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(52, 1fr)", gridAutoRows: 14, gap: 3, marginTop: 8 }}>
          {Array.from({ length: 52 * 7 }).map((_, i) => {
            const v = (Math.sin(i * 1.3) + Math.cos(i * 0.7) + 2) / 4;
            const o = v < 0.25 ? 0.06 : v < 0.5 ? 0.22 : v < 0.75 ? 0.55 : 0.95;
            return <div key={i} style={{ background: `rgba(227,178,72,${o})`, borderRadius: 2, border: "1px solid rgba(0,0,0,.3)" }} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────
function SettingsScreen({ settings, setSettings }) {
  const [tab, setTab] = useState("gameplay");
  const tabs = ["gameplay", "audio", "visuals", "account"];
  return (
    <div className="screen scroll" style={{ height: "100vh", overflow: "auto", padding: "40px 60px" }}>
      <h1 className="disp" style={{ fontSize: 56, margin: "0 0 24px", fontStyle: "italic" }}>
        <span className="foil">settings</span>
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 40 }}>
        <div>
          {tabs.map((t) => (
            <div key={t} onClick={() => setTab(t)} className="disp" style={{
              padding: "10px 14px", fontSize: 18, cursor: "pointer", textTransform: "capitalize",
              color: t === tab ? "var(--gold-glow)" : "var(--ink-mute)",
              fontWeight: t === tab ? 700 : 500,
              borderLeft: `3px solid ${t === tab ? "var(--gold)" : "transparent"}`,
              background: t === tab ? "rgba(227,178,72,.05)" : "transparent",
              fontStyle: "italic",
            }}>{t}</div>
          ))}
        </div>

        <div style={{ maxWidth: 720 }}>
          {tab === "gameplay" && (
            <>
              <SettingRow label="auto-reset after loss" sub="board re-deals 3s after BOOM · esc to cancel">
                <Toggle on={settings.autoReset} onChange={() => setSettings(s => ({ ...s, autoReset: !s.autoReset }))} />
              </SettingRow>
              <SettingRow label="auto-reset after win" sub="immediately queue next run">
                <Toggle on={settings.autoResetWin} onChange={() => setSettings(s => ({ ...s, autoResetWin: !s.autoResetWin }))} />
              </SettingRow>
              <SettingRow label="auto-reset delay" sub="seconds before re-deal">
                <Segmented options={[0,1,2,3,5]} value={3} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="flag mode" sub="how do you flag?">
                <Segmented options={["right-click", "long-press", "both"]} value="right-click" onChange={() => {}} />
              </SettingRow>
              <SettingRow label="chord on number" sub="L+R click to open neighbors">
                <Toggle on={true} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="safe first click" sub="server guarantees a 0-cell on click 1">
                <Toggle on={true} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="probability hints after loss" sub="post-game shows knowable-safe cells">
                <Toggle on={true} onChange={() => {}} />
              </SettingRow>
            </>
          )}

          {tab === "audio" && (
            <>
              <SettingRow label="master volume" sub="all sounds">
                <Slider pct={70} />
              </SettingRow>
              <SettingRow label="reveal sound" sub="card-slide.ogg · plays on every cell open">
                <Slider pct={85} />
              </SettingRow>
              <SettingRow label="flag sound" sub="footstep_carpet.ogg">
                <Slider pct={60} />
              </SettingRow>
              <SettingRow label="chain cascade" sub="rising woosh as 0-cells unfurl">
                <Slider pct={75} />
              </SettingRow>
              <SettingRow label="loss kaboom" sub="loud · screen-shake + CRT glitch">
                <Slider pct={100} />
              </SettingRow>
              <SettingRow label="mute on focus loss" sub="">
                <Toggle on={true} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="reduce-motion mode" sub="halves shake, removes CRT glitch">
                <Toggle on={false} onChange={() => {}} />
              </SettingRow>
            </>
          )}

          {tab === "visuals" && (
            <div style={{ padding: 28, textAlign: "center", color: "var(--ink-mute)" }}>
              <Tag tone="gold">→ open Tweaks panel for live theme</Tag>
              <div className="disp" style={{ fontSize: 28, marginTop: 14, fontStyle: "italic" }}>theme controls live in the floating panel</div>
              <div style={{ marginTop: 10 }}>toggle "Tweaks" from the bottom-right.</div>
            </div>
          )}

          {tab === "account" && (
            <div>
              <SettingRow label="email" sub="player_one@mines.gg"><button className="btn btn-ghost">change</button></SettingRow>
              <SettingRow label="city" sub="алматы · shown on city leaderboard"><button className="btn btn-ghost">change</button></SettingRow>
              <SettingRow label="upgrade to Pro" sub="custom skins · advanced replay · ad-free">
                <button className="btn btn-gold">$4.99 / mo</button>
              </SettingRow>
              <SettingRow label="export game data" sub="json · last 1000 runs"><button className="btn btn-ghost">download</button></SettingRow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, sub, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "16px 0", gap: 18, borderBottom: "1px dashed var(--line-soft)" }}>
      <div style={{ flex: 1 }}>
        <div className="disp" style={{ fontSize: 17, fontWeight: 600 }}>{label}</div>
        {sub && <div className="ink2" style={{ fontSize: 13, marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div onClick={onChange} style={{
      position: "relative", width: 52, height: 28, cursor: "pointer",
      borderRadius: 999,
      background: on ? "linear-gradient(180deg, var(--green), var(--green-deep))" : "rgba(0,0,0,.5)",
      border: "1.5px solid " + (on ? "var(--green-deep)" : "var(--line)"),
      boxShadow: on ? "0 0 12px rgba(76,175,106,.4), inset 0 1px 0 rgba(255,255,255,.15)" : "inset 0 2px 4px rgba(0,0,0,.5)",
      transition: "all .2s ease",
    }}>
      <div style={{
        position: "absolute", top: 2, left: on ? 25 : 2,
        width: 22, height: 22, borderRadius: "50%",
        background: "linear-gradient(180deg, #f5edd6, #cbb785)",
        boxShadow: "0 1px 2px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.5)",
        transition: "left .2s ease",
      }} />
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(0,0,0,.4)", border: "1px solid var(--line-soft)", borderRadius: 6 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className="mono upper" style={{
          fontSize: 10, padding: "8px 14px", letterSpacing: "0.12em",
          background: o === value ? "linear-gradient(180deg, var(--gold-glow), var(--gold))" : "transparent",
          color: o === value ? "#2a1d04" : "var(--ink-2)",
          border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700,
        }}>{o}</button>
      ))}
    </div>
  );
}

function Slider({ pct }) {
  return (
    <div style={{ position: "relative", width: 200, height: 26 }}>
      <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 4, background: "rgba(0,0,0,.5)", borderRadius: 2, border: "1px solid var(--line-soft)" }} />
      <div style={{ position: "absolute", top: 11, left: 0, width: pct * 2 + "px", height: 4, background: "linear-gradient(90deg, var(--gold-deep), var(--gold-glow))", borderRadius: 2, boxShadow: "0 0 6px var(--gold)" }} />
      <div style={{ position: "absolute", top: 3, left: pct * 2 - 10 + "px", width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(180deg, #f5edd6, #cbb785)", border: "1.5px solid var(--gold-deep)", boxShadow: "0 1px 2px rgba(0,0,0,.5)" }} />
    </div>
  );
}

// ─── Multiplayer / Find Race ─────────────────────────────────
function MultiScreen() {
  return (
    <div className="screen scroll" style={{ height: "100vh", overflow: "auto", padding: "40px 60px" }}>
      <h1 className="disp" style={{ fontSize: 78, margin: 0, fontStyle: "italic" }}>
        <span className="foil">find</span> <span style={{ color: "var(--ink)" }}>a race.</span>
      </h1>
      <p className="ink2" style={{ fontSize: 16, maxWidth: 540, marginTop: 8 }}>
        Same server-dealt board. Both players start the same moment. First clean clear wins. Ties → 3bv tiebreak.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 30 }}>
        <div>
          <SectionH title="config" />
          <div className="panel" style={{ padding: 22 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginBottom: 8 }}>difficulty</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[["beg", "9×9 · 10"], ["int", "16×16 · 40"], ["exp", "30×16 · 99"], ["?", "custom"]].map(([d, s], i) => (
                <div key={d} className={i === 1 ? "panel panel-gold" : "panel"} style={{ padding: 12, textAlign: "center", cursor: "pointer", borderColor: i === 1 ? "var(--gold-deep)" : "var(--line)" }}>
                  <div className="disp" style={{ fontSize: 22, fontWeight: 800, fontStyle: "italic" }}>{d}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 22, marginBottom: 8 }}>format</div>
            <Segmented options={["bo1", "bo3", "bo5", "bo7"]} value="bo3" onChange={() => {}} />
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 22, marginBottom: 8 }}>elo range · ±150</div>
            <div style={{ position: "relative", width: "100%", height: 28 }}>
              <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 6, background: "rgba(0,0,0,.5)", borderRadius: 3 }} />
              <div style={{ position: "absolute", top: 12, left: "30%", width: "30%", height: 6, background: "linear-gradient(90deg, var(--gold-deep), var(--gold-glow))", borderRadius: 3, boxShadow: "0 0 8px var(--gold)" }} />
              <div style={{ position: "absolute", top: 0, left: "30%", transform: "translateX(-50%)", width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(180deg, #f5edd6, #cbb785)", border: "1.5px solid var(--gold-deep)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "#2a1d04" }}>1100</div>
              <div style={{ position: "absolute", top: 0, left: "60%", transform: "translateX(-50%)", width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(180deg, #f5edd6, #cbb785)", border: "1.5px solid var(--gold-deep)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: "#2a1d04" }}>1400</div>
            </div>
            <button className="btn btn-gold sparkle" style={{ width: "100%", marginTop: 28, fontSize: 22, padding: "16px" }}>
              ▶ find opponent
            </button>
            <div className="mono" style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)", marginTop: 12 }}>
              ~14s avg · 42 players in your range
            </div>
          </div>
        </div>

        <div>
          <SectionH title="searching…" sub="example state" />
          <div className="panel panel-gold board-frame" style={{ padding: 30, textAlign: "center" }}>
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--gold-deep)", borderTopColor: "var(--gold-glow)", animation: "spin 1.2s linear infinite" }} />
              <div style={{ position: "absolute", inset: 16, display: "grid", placeItems: "center", fontSize: 36, color: "var(--gold-glow)" }}>◆</div>
            </div>
            <div className="disp" style={{ fontSize: 28, marginTop: 18, fontStyle: "italic" }}>searching opponents…</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>elo 1100–1400 · int · bo3</div>

            <div style={{ textAlign: "left", marginTop: 20, padding: 14, background: "rgba(0,0,0,.4)", borderRadius: 6, border: "1px solid var(--line-soft)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.8, color: "var(--ink-2)" }}>
              <div><span className="mute">[00:01]</span> queued</div>
              <div><span className="mute">[00:04]</span> candidate · m4ds 1701 → <span className="red">out of range</span></div>
              <div><span className="mute">[00:07]</span> candidate · sw3ep 1490 <span className="green">✓</span></div>
              <div><span className="mute">[00:09]</span> match locked · seed <span className="gold">0x7af3</span></div>
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 16 }}>cancel</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

Object.assign(window, { DailyScreen, LeaderboardScreen, ProfileScreen, SettingsScreen, MultiScreen });
