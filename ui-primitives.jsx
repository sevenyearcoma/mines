// ui-primitives.jsx — shared visual primitives for MINES

// MINES wordmark — italic foil display
function Wordmark({ size = 32, sub }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
      <div className="wordmark" data-text="MINES" style={{ fontSize: size }}>MINES</div>
      {sub && (
        <div className="mono upper" style={{ fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.32em", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// Decorative side ornament — engraved divider, balatro-flourish vibe
function Ornament({ w = 80, color = "var(--gold-deep)" }) {
  return (
    <svg width={w} height="14" viewBox="0 0 80 14" style={{ display: "block" }}>
      <path d="M0 7 L26 7" stroke={color} strokeWidth="1.2" />
      <circle cx="32" cy="7" r="2" fill={color} />
      <path d="M36 7 Q40 1, 44 7 T52 7" stroke={color} strokeWidth="1.2" fill="none" />
      <circle cx="56" cy="7" r="2" fill={color} />
      <path d="M62 7 L80 7" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

// HUD chunky readout
function HudReadout({ label, value, tone = "gold", w }) {
  return (
    <div className="hud" style={{ minWidth: w }}>
      <div className="hud-label">{label}</div>
      <div className={"hud-value " + (tone === "red" ? "red" : tone === "green" ? "green" : "")}>{value}</div>
    </div>
  );
}

// Avatar — rounded square with initials + tint
function Avatar({ size = 32, initials = "PL", tint = "#7a4a2c" }) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: size * 0.22,
        background: `linear-gradient(180deg, ${tint}88, ${tint})`,
        border: "1.5px solid #00000055",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), 0 1px 0 #000",
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-display)", fontWeight: 800,
        fontSize: size * 0.42, color: "#fff",
        textShadow: "0 1px 0 rgba(0,0,0,.5)",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// Tag (compact label)
function Tag({ children, tone = "neutral", style }) {
  const cls = tone === "gold" ? "chip chip-gold"
            : tone === "red"  ? "chip chip-red"
            : tone === "green"? "chip chip-green"
            : "chip";
  return <span className={cls} style={style}>{children}</span>;
}

// Section header with ornament
function SectionH({ title, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="disp" style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
        {sub && <div className="mono upper" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{sub}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// Live ticker line
function TickerLine({ name, action, time, delta }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "20px 1fr auto auto",
      gap: 10, alignItems: "center",
      padding: "6px 0",
      borderBottom: "1px dashed var(--line-soft)",
      fontFamily: "var(--font-mono)", fontSize: 11,
    }}>
      <span style={{ color: action === "BOOM" ? "var(--red-glow)" : "var(--green)" }}>
        {action === "BOOM" ? "✗" : "✓"}
      </span>
      <span style={{ color: "var(--ink-2)" }}>{name}</span>
      <span style={{ color: "var(--ink-mute)" }}>{time}</span>
      <span style={{ color: delta > 0 ? "var(--green)" : "var(--red-glow)", fontWeight: 600 }}>
        {delta > 0 ? "+" : ""}{delta}
      </span>
    </div>
  );
}

// Mini sparkline (svg path)
function Sparkline({ data, w = 120, h = 28, color = "var(--green)" }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * step} cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
              r="2.5" fill={color} />
    </svg>
  );
}

// Avatar w/ rank glow
function RankBadge({ tier = "silver", elo = 1247 }) {
  const tones = {
    plate: "#b8a78a",
    copper: "#b07a4a",
    silver: "#c0c8d0",
    gold: "#e3b248",
    ruby: "#d63b3b",
    neon: "#c97aff",
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4,
        background: `radial-gradient(circle, ${tones[tier]}, ${tones[tier]}88)`,
        border: `1px solid ${tones[tier]}`,
        boxShadow: `0 0 8px ${tones[tier]}55`,
      }} />
      <span className="disp" style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize" }}>
        {tier}
      </span>
      <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{elo}</span>
    </div>
  );
}

Object.assign(window, {
  Wordmark, Ornament, HudReadout, Avatar, Tag, SectionH, TickerLine, Sparkline, RankBadge,
});
