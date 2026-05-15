"use client";

import { useMemo } from "react";
import { computeAllStats } from "@/lib/stats/compute";
import { generateInsights } from "@/lib/stats/insights";
import type { Game } from "@/lib/types/db";
import { BoomHeatmap } from "./BoomHeatmap";
import { Card } from "./Card";
import { DecisionSpeedBars } from "./DecisionSpeedBars";
import { HeadlineStats } from "./HeadlineStats";
import { InsightCards } from "./InsightCards";
import { TimeOfDayStrip } from "./TimeOfDayStrip";
import { WinRateBars } from "./WinRateBars";

// Single client component that takes the raw games[] and renders the full
// "Deep cuts" section. Server fetches the games, hands them in — all derived
// state lives here.
export function DeepCuts({ games }: { games: Game[] }) {
  const stats = useMemo(() => computeAllStats(games), [games]);
  const insights = useMemo(() => generateInsights(stats), [stats]);

  if (games.length === 0) {
    return null;
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div className="div-label">deep cuts</div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            letterSpacing: "0.04em",
          }}
        >
          {stats.totalGames} game{stats.totalGames === 1 ? "" : "s"} ·{" "}
          {stats.gamesWithActions} with action logs
        </div>
      </div>

      <HeadlineStats stats={stats} />

      <Card
        title="insights"
        sub="pulled from your action logs — actionable, ranked by impact"
      >
        <InsightCards insights={insights} />
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        <Card
          title="boom heatmap"
          sub="where on the board you die · normalized to 16×16"
        >
          <BoomHeatmap
            heatmap={stats.boomHeatmap}
            max={stats.boomHeatmapMax}
            regions={stats.boomRegions}
            total={stats.totalBooms}
          />
        </Card>
        <Card
          title="win rate by difficulty"
          sub="harder boards reward different skills"
        >
          <WinRateBars byDifficulty={stats.byDifficulty} />
        </Card>
        <Card
          title="decision speed"
          sub="time between consecutive reveal/chord actions"
        >
          <DecisionSpeedBars
            buckets={stats.decisionSpeed}
            total={stats.decisionSpeedTotal}
            medianMs={stats.medianDecisionMs}
          />
        </Card>
        <Card title="time of day" sub="when you play and when you win">
          <TimeOfDayStrip
            buckets={stats.timeOfDay}
            bestHour={stats.bestHour}
          />
        </Card>
      </div>
    </section>
  );
}
