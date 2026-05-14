"use client";

export function ComboBadge({
  multiplier,
  speedMultiplier = multiplier,
  accuracyMultiplier = 1,
  streak,
  accuracyStreak = 0,
  lives,
  maxLives,
  stunRemainingMs = 0,
  minWidth = 112,
}: {
  multiplier: number;
  speedMultiplier?: number;
  accuracyMultiplier?: number;
  streak: number;
  accuracyStreak?: number;
  lives?: number;
  maxLives?: number;
  stunRemainingMs?: number;
  minWidth?: number;
}) {
  const stunned = stunRemainingMs > 0;
  const active = streak > 0 && multiplier > 1.001;
  const hot = multiplier >= 4 || speedMultiplier >= 2.5 || accuracyMultiplier >= 2.5;
  const maxed = speedMultiplier >= 2.95 || accuracyMultiplier >= 2.95;
  const speedPct = pct3x(speedMultiplier);
  const accuracyPct = pct3x(accuracyMultiplier);
  const hpText =
    lives !== undefined && maxLives !== undefined ? `HP ${lives}/${maxLives}` : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 5,
        padding: "6px 12px 8px",
        minWidth,
        border: active || stunned
          ? `1px solid ${hot || stunned ? "rgba(255,90,90,0.62)" : "rgba(227,178,72,0.56)"}`
          : "1px solid var(--line)",
        borderRadius: 8,
        background: stunned
          ? "linear-gradient(180deg, rgba(255,90,90,0.24), rgba(0,0,0,0.34))"
          : active
            ? hot
              ? "linear-gradient(180deg, rgba(255,90,90,0.20), rgba(0,0,0,0.30))"
              : "linear-gradient(180deg, rgba(227,178,72,0.17), rgba(0,0,0,0.28))"
            : "rgba(0,0,0,0.25)",
        boxShadow: active || stunned
          ? hot || stunned
            ? "0 0 22px rgba(255,90,90,0.30), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 0 18px rgba(227,178,72,0.22), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "none",
        transform: maxed ? "translateY(-1px)" : "none",
        transition:
          "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
      }}
    >
      <div
        className="mono upper"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 9,
          color: stunned
            ? "var(--red-glow)"
            : active
              ? "var(--gold-glow)"
              : "var(--ink-mute)",
        }}
      >
        <span>{stunned ? `stun ${Math.ceil(stunRemainingMs / 1000)}s` : `combo x${streak}`}</span>
        {hpText && <span>{hpText}</span>}
      </div>

      <div
        className="disp"
        style={{
          textAlign: "center",
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 800,
          color: stunned
            ? "var(--red-glow)"
            : active
              ? hot
                ? "var(--red-glow)"
                : "var(--gold)"
              : "var(--ink-2)",
          textShadow: hot || stunned
            ? "0 0 14px rgba(255,90,90,0.55), 0 1px 0 #000"
            : active
              ? "0 0 12px rgba(227,178,72,0.35), 0 1px 0 #000"
              : "none",
        }}
      >
        x{multiplier.toFixed(2)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Lane
          label={`spd x${speedMultiplier.toFixed(2)}`}
          pct={speedPct}
          color="linear-gradient(90deg, var(--gold-deep), var(--gold), var(--orange))"
        />
        <Lane
          label={`acc x${accuracyMultiplier.toFixed(2)}`}
          pct={accuracyPct}
          color="linear-gradient(90deg, var(--green), var(--gold), var(--gold-glow))"
          sub={accuracyStreak > 0 ? String(accuracyStreak) : undefined}
        />
      </div>
    </div>
  );
}

function Lane({
  label,
  pct,
  color,
  sub,
}: {
  label: string;
  pct: number;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="mono upper"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 4,
          fontSize: 8,
          color: "var(--ink-mute)",
          whiteSpace: "nowrap",
        }}
      >
        <span>{label}</span>
        {sub && <span>{sub}</span>}
      </div>
      <div
        style={{
          width: "100%",
          height: 4,
          marginTop: 2,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: color,
            boxShadow: pct > 2 ? "0 0 10px rgba(227,178,72,0.35)" : "none",
            transition: "width 180ms ease",
          }}
        />
      </div>
    </div>
  );
}

function pct3x(multiplier: number): number {
  return Math.min(100, Math.max(0, ((multiplier - 1) / 2) * 100));
}
