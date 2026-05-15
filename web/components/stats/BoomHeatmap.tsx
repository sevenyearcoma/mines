"use client";

import type { BoomRegions } from "@/lib/stats/compute";

const SIZE = 16;
const CELL = 18;

// Normalized 16×16 grid of boom positions across all difficulties. Cell color
// scales with the local frequency relative to the busiest cell.
export function BoomHeatmap({
  heatmap,
  max,
  regions,
  total,
}: {
  heatmap: number[];
  max: number;
  regions: BoomRegions;
  total: number;
}) {
  if (total === 0) {
    return (
      <div
        className="mono"
        style={{
          padding: 18,
          background: "rgba(0,0,0,0.25)",
          border: "1px dashed var(--line-soft)",
          borderRadius: 8,
          fontSize: 11,
          color: "var(--ink-mute)",
          textAlign: "center",
        }}
      >
        no booms recorded yet — keep playing.
      </div>
    );
  }

  const cornerPct = Math.round((regions.corner / total) * 100);
  const edgePct = Math.round((regions.edge / total) * 100);
  const centerPct = Math.round((regions.center / total) * 100);
  const hotspot = pickHotspotLabel(regions);

  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${SIZE}, ${CELL}px)`,
          gridAutoRows: `${CELL}px`,
          gap: 1,
          padding: 4,
          background: "#070b0d",
          borderRadius: 6,
          border: "1px solid rgba(227,178,72,0.25)",
        }}
        aria-label="Boom heatmap"
      >
        {heatmap.map((count, i) => (
          <BoomCell key={i} count={count} max={max} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
        <RegionRow label="corners" value={regions.corner} pct={cornerPct} accent="red" />
        <RegionRow label="edges" value={regions.edge} pct={edgePct} accent="gold" />
        <RegionRow label="center" value={regions.center} pct={centerPct} accent="ink" />
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-2)",
            lineHeight: 1.5,
            padding: "10px 0 0",
            borderTop: "1px solid var(--line-soft)",
          }}
        >
          {hotspot}
        </div>
      </div>
    </div>
  );
}

function BoomCell({ count, max }: { count: number; max: number }) {
  const intensity = max > 0 ? count / max : 0;
  // Blend dark base with red as intensity rises.
  const r = Math.round(20 + intensity * 215);
  const g = Math.round(28 + intensity * 30);
  const b = Math.round(36 + intensity * 40);
  const glow =
    intensity > 0.3
      ? `0 0 ${Math.round(2 + intensity * 6)}px rgba(255,90,90,${(
          intensity * 0.7
        ).toFixed(2)})`
      : "none";
  return (
    <div
      title={count > 0 ? `${count} boom${count === 1 ? "" : "s"}` : ""}
      style={{
        width: CELL,
        height: CELL,
        background: `rgb(${r}, ${g}, ${b})`,
        borderRadius: 2,
        boxShadow: glow,
      }}
    />
  );
}

function RegionRow({
  label,
  value,
  pct,
  accent,
}: {
  label: string;
  value: number;
  pct: number;
  accent: "red" | "gold" | "ink";
}) {
  const color =
    accent === "red"
      ? "var(--red-glow, #ff8a8a)"
      : accent === "gold"
      ? "var(--gold)"
      : "var(--ink)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          className="mono upper"
          style={{ fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.18em" }}
        >
          {label}
        </span>
        <span
          className="disp"
          style={{ fontSize: 16, fontWeight: 800, color }}
        >
          {pct}%
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-mute)", marginLeft: 6 }}
          >
            ({value})
          </span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 3,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 220ms ease",
          }}
        />
      </div>
    </div>
  );
}

function pickHotspotLabel(regions: BoomRegions): string {
  const total = regions.corner + regions.edge + regions.center;
  if (total === 0) return "";
  if (regions.corner + regions.edge > regions.center * 1.5) {
    return "Most of your booms hug the edges. The perimeter is where number-cells tell the strictest stories — slow down there.";
  }
  if (regions.center > (regions.corner + regions.edge) * 1.4) {
    return "Centre-heavy busts. You're moving fast in the dense interior — give yourself an extra beat once the opening flood settles.";
  }
  return "Booms scatter across the whole board. No single weak zone — focus on speed and tempo instead.";
}
