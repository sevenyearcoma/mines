// game-screen.jsx — the heart: playable minesweeper with juice

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const DIFFS = window.MinesEngine.DIFFS;

function fmtTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// ─── Particles on reveal ─────────────────────────────────────
function spawnParticles(host, x, y, color, n = 6) {
  if (!host) return;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 16 + Math.random() * 24;
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.background = color;
    p.style.boxShadow = `0 0 6px ${color}`;
    p.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    p.style.setProperty("--ty", Math.sin(angle) * dist + "px");
    p.style.width = p.style.height = (3 + Math.random() * 4) + "px";
    host.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

// ─── Board ──────────────────────────────────────────────────
function Board({ state, onReveal, onFlag, onChord, hintCells, boomCell }) {
  const { board, gameOver, won, postLossHints } = state;
  const rows = board.length, cols = board[0].length;
  const particlesRef = useRef(null);
  const cellSize = cols > 20 ? 30 : cols > 10 ? 34 : 42;

  // disable browser context menu
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    const el = particlesRef.current?.parentNode;
    if (el) el.addEventListener("contextmenu", stop);
    return () => { if (el) el.removeEventListener("contextmenu", stop); };
  }, []);

  // track L+R chord
  const mouseDownRef = useRef({ left: false, right: false });

  const handleClick = (r, c, e) => {
    if (gameOver) return;
    onReveal(r, c, e);
  };

  const handleContext = (r, c, e) => {
    e.preventDefault();
    if (gameOver) return;
    onFlag(r, c, e);
  };

  const handleMouseDown = (r, c, e) => {
    if (e.button === 0) mouseDownRef.current.left = true;
    if (e.button === 2) mouseDownRef.current.right = true;
    if (mouseDownRef.current.left && mouseDownRef.current.right) {
      onChord(r, c, e);
    }
  };
  const handleMouseUp = (e) => {
    if (e.button === 0) mouseDownRef.current.left = false;
    if (e.button === 2) mouseDownRef.current.right = false;
  };

  const hintSet = new Set(hintCells.map(h => h.r * cols + h.c));

  return (
    <div className="board-frame">
      <div className="particles" ref={particlesRef} />
      <div
        className="board"
        style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
      >
        {board.flat().map((cell) => {
          const k = cell.r * cols + cell.c;
          const isHint = hintSet.has(k);
          const isBoom = boomCell && boomCell.r === cell.r && boomCell.c === cell.c;
          let cls = "cell";
          if (cell.revealed) cls += " revealed";
          if (cell.revealed && cell.mine) cls += " bomb";
          if (cell.flagged) cls += " flagged";
          if (cell.revealed && cell.adj === 0 && !cell.mine) cls += " zero";
          if (isBoom) cls += " boom";
          if (isHint) cls += " hint-safe";
          // chain stagger
          const stagger = cell.revealStagger || 0;

          return (
            <div
              key={k}
              className={cls}
              style={{
                width: cellSize,
                height: cellSize,
                fontSize: cellSize * 0.6,
                animationDelay: cell.revealed ? `${stagger * 18}ms` : "0ms",
              }}
              onMouseDown={(e) => handleMouseDown(cell.r, cell.c, e)}
              onMouseUp={(e) => { handleMouseUp(e); }}
              onMouseLeave={() => { mouseDownRef.current = { left: false, right: false }; }}
              onClick={(e) => handleClick(cell.r, cell.c, e)}
              onContextMenu={(e) => handleContext(cell.r, cell.c, e)}
            >
              {cell.revealed && cell.mine && <div className="bomb-glyph" />}
              {cell.revealed && !cell.mine && cell.adj > 0 && (
                <span className={"num n" + cell.adj}>{cell.adj}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result Modal ───────────────────────────────────────────
function ResultOverlay({ state, onAgain, onAnalyze, settings, countdown }) {
  if (!state.gameOver) return null;
  const isWin = state.won;
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "grid", placeItems: "center",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,.55), rgba(0,0,0,.85))",
        backdropFilter: "blur(2px)",
        zIndex: 50,
        animation: "screen-in .35s ease-out both",
      }}
    >
      <div className={isWin ? "panel panel-gold" : "panel"} style={{ width: 460, padding: 32, textAlign: "center", borderColor: isWin ? "var(--gold-deep)" : "var(--red-deep)" }}>
        <Ornament w={120} color={isWin ? "var(--gold)" : "var(--red)"} />
        <div className="disp" style={{
          fontSize: 72, marginTop: 8, fontStyle: "italic",
          letterSpacing: "-0.02em", lineHeight: 1,
        }}>
          <span className={isWin ? "foil" : ""} style={!isWin ? { color: "var(--red-glow)", textShadow: "0 0 24px rgba(255,106,106,.6), 0 2px 0 #000" } : {}}>
            {isWin ? "GOOD RUN" : "BOOM."}
          </span>
        </div>
        <div className="mono upper" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 12 }}>
          {isWin ? `cleared in ${fmtTime(state.elapsed)}` : `lost at ${fmtTime(state.elapsed)} · click #${state.clicks}`}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "22px 0 8px" }}>
          <HudReadout label="time"  value={fmtTime(state.elapsed)} tone={isWin ? "gold" : "red"} />
          <HudReadout label="opens" value={state.opens} tone={isWin ? "gold" : "red"} />
          <HudReadout label="elo"   value={isWin ? "+18" : "−24"} tone={isWin ? "green" : "red"} />
        </div>

        {!isWin && (
          <div className="panel" style={{ padding: 12, marginTop: 12, textAlign: "left", background: "rgba(0,0,0,.3)" }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginBottom: 4 }}>
              probability-thinking · cells you could have deduced
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--green)" }}>
              {state.postLossHints.length} safe cells were knowable
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn btn-gold sparkle" onClick={onAgain}>
            ↻ {isWin ? `next ${countdown ? `(${countdown})` : ""}` : `try again ${countdown ? `(${countdown})` : ""}`}
          </button>
          {!isWin && (
            <button className="btn btn-ghost" onClick={onAnalyze}>analyze loss</button>
          )}
          <button className="btn btn-ghost">view replay</button>
        </div>
        {settings.autoReset && countdown !== null && (
          <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", marginTop: 14 }}>
            auto-reset · esc to cancel
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top HUD ────────────────────────────────────────────────
function TopHUD({ state, settings, onReset, onDifficulty }) {
  const flagsUsed = state.board.flat().filter(c => c.flagged).length;
  const remaining = Math.max(0, state.mines - flagsUsed);
  const timeRunningLow = state.elapsed > 60 && !state.gameOver;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "18px 28px",
      borderBottom: "1.5px solid var(--line)",
      background: "linear-gradient(180deg, var(--panel), transparent)",
    }}>
      <HudReadout label="mines" value={String(remaining).padStart(3, "0")} tone="red" w={130} />
      <HudReadout label="time" value={fmtTime(state.elapsed)} tone={timeRunningLow ? "red" : "gold"} w={150} />
      <HudReadout label="opens" value={String(state.opens).padStart(3, "0")} tone="gold" w={110} />

      <div style={{ flex: 1 }} />

      {/* streak meter */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 220 }}>
        <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", display: "flex", justifyContent: "space-between" }}>
          <span>streak · ×{state.streak}</span><span className="gold">{state.streakBest} best</span>
        </div>
        <div className="streak-meter">
          <div className="streak-fill" style={{ width: Math.min(100, state.streak * 20) + "%" }} />
        </div>
      </div>

      <div style={{ width: 1, height: 36, background: "var(--line)" }} />

      {/* difficulty selector */}
      <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(0,0,0,.4)", border: "1px solid var(--line-soft)", borderRadius: 6 }}>
        {Object.entries(DIFFS).map(([k, d]) => (
          <button
            key={k}
            onClick={() => onDifficulty(k)}
            className="mono upper"
            style={{
              fontSize: 10, letterSpacing: "0.16em",
              padding: "6px 10px",
              background: settings.difficulty === k ? "linear-gradient(180deg, var(--gold-glow), var(--gold))" : "transparent",
              color: settings.difficulty === k ? "#2a1d04" : "var(--ink-2)",
              border: "none", borderRadius: 4,
              cursor: "pointer", fontWeight: 700,
              boxShadow: settings.difficulty === k ? "0 1px 0 rgba(0,0,0,.4)" : "none",
            }}
          >
            {k.slice(0, 3)}
          </button>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={onReset} style={{ padding: "10px 14px", fontSize: 14 }}>
        ↻ new
      </button>
    </div>
  );
}

// ─── Side Panel ─────────────────────────────────────────────
function GameSidePanel({ state, settings }) {
  const recents = [
    ["WIN",  "0:38", "+18", "#147"],
    ["WIN",  "1:42", "+12", "#146"],
    ["BOOM", "2:11", "−24", "#145"],
    ["WIN",  "1:17", "+9",  "#144"],
    ["BOOM", "0:44", "−18", "#143"],
    ["WIN",  "1:33", "+14", "#142"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 22px", borderLeft: "1.5px solid var(--line)", background: "rgba(0,0,0,.18)", overflow: "auto" }}>
      <div>
        <SectionH title="this run" sub="live" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div className="panel" style={{ padding: 10 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>3bv/s</div>
            <div className="disp gold" style={{ fontSize: 26, fontWeight: 800 }}>
              {state.opens > 0 && state.elapsed > 0 ? (state.opens / state.elapsed).toFixed(2) : "0.00"}
            </div>
          </div>
          <div className="panel" style={{ padding: 10 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>eff</div>
            <div className="disp gold" style={{ fontSize: 26, fontWeight: 800 }}>
              {state.clicks > 0 ? Math.round((state.opens / state.clicks) * 100) : 0}%
            </div>
          </div>
          <div className="panel" style={{ padding: 10 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>chains</div>
            <div className="disp gold" style={{ fontSize: 26, fontWeight: 800 }}>{state.chains}</div>
          </div>
          <div className="panel" style={{ padding: 10 }}>
            <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)" }}>flags</div>
            <div className="disp gold" style={{ fontSize: 26, fontWeight: 800 }}>
              {state.board.flat().filter(c => c.flagged).length}
            </div>
          </div>
        </div>
      </div>

      <div className="div-label">recent</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {recents.map(([res, t, d, n], i) => (
          <div key={i} className="panel" style={{ padding: "8px 12px", display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center" }}>
            <span className={"chip " + (res === "WIN" ? "chip-green" : "chip-red")}>{res}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>{t}</span>
            <span className="mono" style={{ fontSize: 11, color: d.startsWith("+") ? "var(--green)" : "var(--red-glow)" }}>{d}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{n}</span>
          </div>
        ))}
      </div>

      <div className="div-label">how to</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.9 }}>
        <div><span className="gold">L</span> reveal</div>
        <div><span className="gold">R</span> flag</div>
        <div><span className="gold">L+R</span> chord</div>
        <div><span className="gold">SPC</span> new board</div>
        <div><span className="gold">ESC</span> cancel auto-reset</div>
      </div>

      <div className="panel panel-gold" style={{ padding: 14, marginTop: 4 }}>
        <div className="mono upper" style={{ fontSize: 9, color: "var(--gold-glow)" }}>fair-deal proof</div>
        <div className="disp" style={{ fontSize: 14, marginTop: 4 }}>
          seed <span className="mono gold" style={{ fontSize: 12 }}>0x{state.seed.toString(16).padStart(6, "0")}</span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 2 }}>
          server-dealt · verifiable post-game
        </div>
      </div>
    </div>
  );
}

// ─── Main GameScreen ────────────────────────────────────────
function GameScreen({ settings, setSettings }) {
  const [state, setState] = useState(() => initialState(settings.difficulty));
  const [tick, setTick] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const wrapRef = useRef(null);

  // tick timer
  useEffect(() => {
    if (state.startedAt === null || state.gameOver) return;
    const i = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(i);
  }, [state.startedAt, state.gameOver]);

  const elapsed = state.startedAt === null ? 0
    : Math.floor((Date.now() - state.startedAt - (state.frozenAt ? Date.now() - state.frozenAt : 0)) / 1000);
  state.elapsed = state.gameOver && state.endedAt
    ? Math.floor((state.endedAt - state.startedAt) / 1000)
    : elapsed;

  function initialState(diff) {
    const d = DIFFS[diff];
    return {
      difficulty: diff,
      rows: d.rows, cols: d.cols, mines: d.mines,
      board: window.MinesEngine.emptyBoard(d.rows, d.cols),
      planted: false,
      seed: Math.floor(Math.random() * 0xffffff),
      startedAt: null, endedAt: null,
      gameOver: false, won: false,
      opens: 0, clicks: 0, chains: 0, streak: 0, streakBest: 0,
      postLossHints: [],
    };
  }

  const reset = useCallback((newDiff) => {
    setCountdown(null);
    setState(s => {
      const diff = newDiff || s.difficulty;
      const prev = initialState(diff);
      return { ...prev, streakBest: Math.max(s.streakBest, s.streak), streak: s.gameOver && s.won ? s.streak : 0 };
    });
  }, []);

  // Reveal action
  const onReveal = useCallback((r, c, e) => {
    setState(s => {
      if (s.gameOver) return s;
      const board = s.board;
      const cell = board[r][c];
      if (cell.flagged || cell.revealed) return s;

      // plant on first click
      let planted = s.planted;
      let startedAt = s.startedAt;
      if (!planted) {
        window.MinesEngine.plant(board, s.mines, s.seed, r, c);
        planted = true;
        startedAt = Date.now();
      }

      const res = window.MinesEngine.reveal(board, r, c);
      // attach stagger info
      for (const rev of res.revealed) {
        board[rev.r][rev.c].revealStagger = rev.dist;
      }
      // particles
      const wrap = wrapRef.current;
      if (wrap) {
        for (const rev of res.revealed.slice(0, 8)) {
          const cellEl = wrap.querySelector(`.board > :nth-child(${rev.r * s.cols + rev.c + 1})`);
          if (!cellEl) continue;
          const host = wrap.querySelector(".particles");
          if (!host) continue;
          const hr = host.getBoundingClientRect();
          const er = cellEl.getBoundingClientRect();
          spawnParticles(host, er.left - hr.left + er.width / 2, er.top - hr.top + er.height / 2, "#e3b248", 3);
        }
      }

      const opens = s.opens + res.revealed.length;
      const clicks = s.clicks + 1;
      const chains = res.revealed.length > 4 ? s.chains + 1 : s.chains;

      // check win/lose
      if (res.hitMine) {
        // BOOM
        const boomCell = { r, c };
        window.MinesEngine.revealAllMines(board);
        const hints = window.MinesEngine.deducibleSafe(board);
        if (wrap) {
          wrap.classList.remove("shake");
          // force reflow
          void wrap.offsetWidth;
          wrap.classList.add("shake");
        }
        // sound proxy: pulse the bg
        return { ...s, board: [...board], planted, startedAt, opens, clicks,
          gameOver: true, won: false, endedAt: Date.now(),
          boomCell, postLossHints: hints, streak: 0,
        };
      }

      const won = window.MinesEngine.isWin(board, s.mines);
      if (won) {
        return { ...s, board: [...board], planted, startedAt, opens, clicks,
          gameOver: true, won: true, endedAt: Date.now(),
          streak: s.streak + 1, streakBest: Math.max(s.streakBest, s.streak + 1),
        };
      }

      return { ...s, board: [...board], planted, startedAt, opens, clicks, chains };
    });
  }, []);

  const onFlag = useCallback((r, c) => {
    setState(s => {
      if (s.gameOver) return s;
      window.MinesEngine.flag(s.board, r, c);
      return { ...s, board: [...s.board] };
    });
  }, []);

  const onChord = useCallback((r, c) => {
    setState(s => {
      if (s.gameOver) return s;
      const cell = s.board[r][c];
      if (!cell.revealed || cell.adj === 0) return s;
      const res = window.MinesEngine.chord(s.board, r, c);
      for (const rev of res.revealed) s.board[rev.r][rev.c].revealStagger = rev.dist;
      const opens = s.opens + res.revealed.length;
      if (res.hitMine) {
        window.MinesEngine.revealAllMines(s.board);
        const hints = window.MinesEngine.deducibleSafe(s.board);
        if (wrapRef.current) {
          wrapRef.current.classList.remove("shake");
          void wrapRef.current.offsetWidth;
          wrapRef.current.classList.add("shake");
        }
        return { ...s, board: [...s.board], opens, gameOver: true, won: false, endedAt: Date.now(), boomCell: { r, c }, postLossHints: hints, streak: 0 };
      }
      const won = window.MinesEngine.isWin(s.board, s.mines);
      return { ...s, board: [...s.board], opens, gameOver: won, won, endedAt: won ? Date.now() : null, streak: won ? s.streak + 1 : s.streak };
    });
  }, []);

  const onDifficulty = (d) => {
    setSettings(prev => ({ ...prev, difficulty: d }));
    reset(d);
  };

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" && !e.target.closest("input,textarea")) { e.preventDefault(); reset(); }
      if (e.code === "Escape") setCountdown(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  // auto-reset countdown after game over
  useEffect(() => {
    if (!state.gameOver) { setCountdown(null); return; }
    if (!settings.autoReset) { setCountdown(null); return; }
    setCountdown(3);
    let n = 3;
    const i = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(i);
        reset();
      } else {
        setCountdown(n);
      }
    }, 1000);
    return () => clearInterval(i);
  }, [state.gameOver, settings.autoReset, reset]);

  // restart if settings.difficulty changes externally
  useEffect(() => {
    if (state.difficulty !== settings.difficulty) reset(settings.difficulty);
  }, [settings.difficulty]);

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopHUD state={state} settings={settings} onReset={() => reset()} onDifficulty={onDifficulty} />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", minHeight: 0 }}>
        <div ref={wrapRef} style={{ position: "relative", display: "grid", placeItems: "center", padding: 30, overflow: "auto" }}>
          <Board
            state={state}
            onReveal={onReveal}
            onFlag={onFlag}
            onChord={onChord}
            hintCells={state.gameOver && !state.won ? state.postLossHints : []}
            boomCell={state.boomCell}
          />
          <ResultOverlay state={state} onAgain={() => reset()} onAnalyze={() => {}} settings={settings} countdown={countdown} />
        </div>

        <GameSidePanel state={state} settings={settings} />
      </div>
    </div>
  );
}

Object.assign(window, { GameScreen });
