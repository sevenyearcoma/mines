// app.jsx — top-level router, nav rail, tweaks integration

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "boardSkin": "tiles",
  "juice": "max"
}/*EDITMODE-END*/;

function NavRail({ current, goto, settings }) {
  const items = [
    { k: "home",  icon: "♣", label: "lobby" },
    { k: "play",  icon: "▶", label: "quick play" },
    { k: "multi", icon: "⇄", label: "find race" },
    { k: "daily", icon: "◷", label: "daily" },
    { k: "ranks", icon: "♛", label: "ranks" },
    { k: "me",    icon: "◉", label: "profile" },
    { k: "set",   icon: "✎", label: "settings" },
  ];
  return (
    <aside className="rail">
      <div style={{ padding: "22px 18px 14px", borderBottom: "1.5px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div onClick={() => goto("home")} style={{ cursor: "pointer" }}>
          <Wordmark size={26} sub="hi-fi · v0.1" />
        </div>
      </div>

      <div style={{ padding: "12px 0", flex: 1, overflowY: "auto" }}>
        {items.map((it) => (
          <div
            key={it.k}
            className={"rail-item" + (current === it.k ? " active" : "")}
            onClick={() => goto(it.k)}
          >
            <div className="rail-icon">{it.icon}</div>
            <div style={{ flex: 1 }}>{it.label}</div>
          </div>
        ))}
      </div>

      {/* User card at bottom */}
      <div style={{ padding: 14, borderTop: "1.5px solid var(--line)", background: "rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={36} initials="PL" tint="#5b9eff" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>player_one</div>
            <RankBadge tier="silver" elo={1247} />
          </div>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
          <span>● online</span>
          <span>14 → gold</span>
        </div>
        <div style={{ marginTop: 6, height: 4, background: "rgba(0,0,0,.4)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: "62%", height: "100%", background: "linear-gradient(90deg, var(--gold-deep), var(--gold-glow))", boxShadow: "0 0 4px var(--gold)" }} />
        </div>
      </div>
    </aside>
  );
}

// ─── Auto-mocked Post-Game (linked from H2H or solo win) ─────
function PostGameMock() {
  return (
    <div className="screen" style={{ padding: 40, height: "100vh", overflow: "auto" }}>
      <div className="disp" style={{ fontSize: 36, fontStyle: "italic" }}>post-game lives in-game</div>
      <div className="ink2" style={{ marginTop: 8 }}>
        Win and lose overlays appear over the board itself, not a separate route. Try losing a quick play game!
      </div>
    </div>
  );
}

// ─── App root ────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState("home");
  const [settings, setSettings] = useState({
    difficulty: "intermediate",
    autoReset: true,
    autoResetWin: true,
  });

  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // apply theme via data-theme on <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme || "dark");
  }, [tweaks.theme]);

  const goto = (k) => setScreen(k);

  let body;
  switch (screen) {
    case "home":  body = <LandingScreen   goto={goto} settings={settings} />; break;
    case "play":  body = <GameScreen      settings={settings} setSettings={setSettings} />; break;
    case "multi": body = <MultiScreen     />; break;
    case "daily": body = <DailyScreen     goto={goto} />; break;
    case "ranks": body = <LeaderboardScreen />; break;
    case "me":    body = <ProfileScreen   />; break;
    case "set":   body = <SettingsScreen  settings={settings} setSettings={setSettings} />; break;
    default:      body = <LandingScreen   goto={goto} settings={settings} />;
  }

  return (
    <div className="app">
      <NavRail current={screen} goto={goto} settings={settings} />
      <main className="app-main" key={screen}>{body}</main>

      <window.TweaksPanel title="MINES · tweaks">
        <window.TweakSection label="Theme">
          <window.TweakRadio
            label="palette"
            value={tweaks.theme}
            options={[
              { value: "dark",  label: "dark" },
              { value: "felt",  label: "felt" },
              { value: "light", label: "light" },
            ]}
            onChange={(v) => setTweak("theme", v)}
          />
        </window.TweakSection>

        <window.TweakSection label="Juice">
          <window.TweakRadio
            label="intensity"
            value={tweaks.juice}
            options={[
              { value: "low",  label: "low" },
              { value: "med",  label: "med" },
              { value: "max",  label: "max" },
            ]}
            onChange={(v) => setTweak("juice", v)}
          />
        </window.TweakSection>

        <window.TweakSection label="Gameplay">
          <window.TweakToggle
            label="auto-reset after loss"
            value={settings.autoReset}
            onChange={(v) => setSettings(s => ({ ...s, autoReset: v }))}
          />
          <window.TweakToggle
            label="auto-reset after win"
            value={settings.autoResetWin}
            onChange={(v) => setSettings(s => ({ ...s, autoResetWin: v }))}
          />
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
