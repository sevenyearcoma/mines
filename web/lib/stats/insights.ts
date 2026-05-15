// Pattern-spotter that turns computed stats into 3-6 actionable sentences.
// Insights are ranked: the most useful ones float to the top of the card list.

import type { ComputedStats } from "./compute";
import { fmtTime } from "@/lib/format";

export type InsightTone = "good" | "warn" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  // Pithy, eye-catching title — gets the big font on the card.
  title: string;
  // One-sentence explanation. Should reference concrete numbers from stats.
  body: string;
  // 0..10 — drives sort order. Higher = surfaced first.
  weight: number;
}

const HOUR_LABELS = [
  "midnight",
  "1am",
  "2am",
  "3am",
  "4am",
  "5am",
  "6am",
  "7am",
  "8am",
  "9am",
  "10am",
  "11am",
  "noon",
  "1pm",
  "2pm",
  "3pm",
  "4pm",
  "5pm",
  "6pm",
  "7pm",
  "8pm",
  "9pm",
  "10pm",
  "11pm",
];

export function generateInsights(stats: ComputedStats): Insight[] {
  const out: Insight[] = [];

  // -- 1. Boom region bias (high signal — actionable) -------------------
  const { boomRegions, totalBooms } = stats;
  if (totalBooms >= 5) {
    const pct = (n: number) => Math.round((n / totalBooms) * 100);
    const corner = pct(boomRegions.corner);
    const edge = pct(boomRegions.edge);
    const center = pct(boomRegions.center);
    if (edge >= 55) {
      out.push({
        id: "boom_edge",
        tone: "warn",
        title: "Edges punish you",
        body: `${edge}% of your booms happen in the ring near the board's edges. Those cells have fewer neighbours, so each number constrains the layout more — slow down at the perimeter.`,
        weight: 9,
      });
    } else if (corner >= 25) {
      out.push({
        id: "boom_corner",
        tone: "warn",
        title: "Corners catch you",
        body: `${corner}% of your booms land in a corner. Corner cells have only three neighbours; if a 2 sits next to a corner, the corner is almost always a mine — flag earlier.`,
        weight: 8,
      });
    } else if (center >= 60) {
      out.push({
        id: "boom_center",
        tone: "warn",
        title: "Centre rush",
        body: `${center}% of your booms are in the dense centre of the board. You're moving fast in the high-information zone — give yourself an extra beat once you're past the opening flood.`,
        weight: 8,
      });
    }
  }

  // -- 2. Decision speed personality ------------------------------------
  const { decisionSpeed, decisionSpeedTotal, medianDecisionMs } = stats;
  if (decisionSpeedTotal >= 30 && medianDecisionMs !== null) {
    const total = decisionSpeedTotal;
    const fastShare =
      (decisionSpeed.instant + decisionSpeed.fast) / total;
    const slowShare =
      (decisionSpeed.hesitant + decisionSpeed.frozen) / total;
    if (fastShare >= 0.55) {
      out.push({
        id: "speed_sprinter",
        tone: "good",
        title: "You're a sprinter",
        body: `${Math.round(
          fastShare * 100,
        )}% of your reveals fire in under half a second (median ${Math.round(
          medianDecisionMs,
        )}ms). Quick reads — the danger is missing chains you'd see with one more breath.`,
        weight: 7,
      });
    } else if (slowShare >= 0.35) {
      out.push({
        id: "speed_thinker",
        tone: "neutral",
        title: "You're a thinker",
        body: `${Math.round(
          slowShare * 100,
        )}% of your moves take 2+ seconds (median ${Math.round(
          medianDecisionMs,
        )}ms). Slow play wins you accuracy but bleeds the speed bonus — try chord-clicking obvious clusters first to recover tempo.`,
        weight: 6,
      });
    } else {
      out.push({
        id: "speed_balanced",
        tone: "neutral",
        title: "Even tempo",
        body: `Median move: ${Math.round(
          medianDecisionMs,
        )}ms. Solid mix of pace and patience — the next gain probably comes from playing harder boards.`,
        weight: 4,
      });
    }
  }

  // -- 3. Pacing drift ---------------------------------------------------
  const { firstHalfAvgMs, secondHalfAvgMs, pacingDelta } = stats;
  if (
    firstHalfAvgMs !== null &&
    secondHalfAvgMs !== null &&
    pacingDelta !== null
  ) {
    if (pacingDelta > 400) {
      out.push({
        id: "pacing_slowing",
        tone: "warn",
        title: "You stall mid-game",
        body: `You start at ${Math.round(
          firstHalfAvgMs,
        )}ms per move, then drop to ${Math.round(
          secondHalfAvgMs,
        )}ms in the second half — a +${Math.round(
          pacingDelta,
        )}ms hit. The mines get harder to read, but your speed bonus dies fastest in those final 30 seconds.`,
        weight: 7,
      });
    } else if (pacingDelta < -300) {
      out.push({
        id: "pacing_warmup",
        tone: "good",
        title: "Slow start, fast finish",
        body: `You speed UP in the second half (${Math.round(
          firstHalfAvgMs,
        )}ms → ${Math.round(
          secondHalfAvgMs,
        )}ms). Your reads sharpen as the board fills in — opening flagging discipline could buy you more time.`,
        weight: 5,
      });
    }
  }

  // -- 4. Best hour ------------------------------------------------------
  const { bestHour, totalGames } = stats;
  if (bestHour && totalGames >= 20) {
    const pct = Math.round(bestHour.winRate * 100);
    if (pct >= 55) {
      out.push({
        id: "best_hour",
        tone: "good",
        title: `Sharp around ${HOUR_LABELS[bestHour.hour]}`,
        body: `Your peak win rate is ${pct}% in the ${HOUR_LABELS[bestHour.hour]} hour (${bestHour.games} games). Schedule your hardest sessions there.`,
        weight: 6,
      });
    }
  }

  // -- 5. Difficulty gap -------------------------------------------------
  const { byDifficulty, mostPlayed } = stats;
  if (mostPlayed) {
    const beg = byDifficulty.beginner;
    const int = byDifficulty.intermediate;
    const exp = byDifficulty.expert;
    if (mostPlayed === "beginner" && beg.winRate >= 0.7 && beg.games >= 10) {
      out.push({
        id: "diff_climb",
        tone: "neutral",
        title: "Time to climb",
        body: `Beginner win rate: ${Math.round(
          beg.winRate * 100,
        )}% over ${beg.games} games. The board is solved for you — most learning happens on intermediate.`,
        weight: 8,
      });
    } else if (int.games >= 10 && exp.games < 5) {
      out.push({
        id: "diff_try_expert",
        tone: "neutral",
        title: "Try expert",
        body: `${int.games} intermediate games and barely any expert. Expert is where flag discipline becomes the whole game.`,
        weight: 5,
      });
    } else if (exp.games >= 10 && exp.winRate < 0.1) {
      out.push({
        id: "diff_expert_grind",
        tone: "warn",
        title: "Expert is a grind",
        body: `${Math.round(
          exp.winRate * 100,
        )}% expert win rate. Variance is high there — even pros sit around 30%. Mix in intermediate to keep your edge sharp.`,
        weight: 4,
      });
    }
  }

  // -- 6. Time-to-first-boom (rusher detection) -------------------------
  const { avgTimeToFirstBoomMs, totalLosses } = stats;
  if (avgTimeToFirstBoomMs !== null && totalLosses >= 5) {
    const secs = avgTimeToFirstBoomMs / 1000;
    if (secs < 12) {
      out.push({
        id: "rusher",
        tone: "warn",
        title: "You go boom early",
        body: `Average time to your bust: ${fmtTime(
          Math.floor(secs),
        )}. Most opening floods solve themselves — slow your first ten reveals to read the numbers they expose.`,
        weight: 7,
      });
    } else if (secs > 90) {
      out.push({
        id: "marathon",
        tone: "neutral",
        title: "You die at the finish line",
        body: `You survive an average of ${fmtTime(
          Math.floor(secs),
        )} before busting. The endgame is where flag discipline matters most — count remaining mines vs unrevealed cells before each pick.`,
        weight: 6,
      });
    }
  }

  // -- 7. Guess habits --------------------------------------------------
  const gs = stats.guessStats;
  if (gs.totalReveals >= 50 && gs.guesses > 0) {
    const guessRate = gs.guesses / gs.totalReveals;
    const succRate = gs.guessSuccessRate;
    if (guessRate >= 0.3 && succRate < 0.7) {
      out.push({
        id: "guess_overreach",
        tone: "warn",
        title: "Guessing too often",
        body: `${Math.round(
          guessRate * 100,
        )}% of your reveals were guesses (not provable from the board), and only ${Math.round(
          succRate * 100,
        )}% of those survived. Slow down — chord-click satisfied numbers before reaching into the dark.`,
        weight: 9,
      });
    } else if (guessRate >= 0.3 && succRate >= 0.85) {
      out.push({
        id: "guess_intuition",
        tone: "good",
        title: "Reads under uncertainty",
        body: `You guess on ${Math.round(
          guessRate * 100,
        )}% of reveals but land ${Math.round(
          succRate * 100,
        )}% safely. Strong intuition for low-info spots — this is what separates fast solvers from cautious ones.`,
        weight: 8,
      });
    } else if (guessRate < 0.12 && gs.totalReveals >= 80) {
      out.push({
        id: "guess_disciplined",
        tone: "good",
        title: "Disciplined deducer",
        body: `Only ${Math.round(
          guessRate * 100,
        )}% of your reveals were guesses — the rest were provably safe from numbers alone. Your endgame floor is solid; speed is the next ceiling.`,
        weight: 6,
      });
    } else if (succRate < 0.6 && gs.guesses >= 10) {
      out.push({
        id: "guess_unlucky",
        tone: "warn",
        title: "Guesses don't pay",
        body: `When you guess, you bust ${Math.round(
          (1 - succRate) * 100,
        )}% of the time. The numbers usually rule out some candidates even when no cell is 100% safe — pick the ones that minimize touches with high-mine cells.`,
        weight: 7,
      });
    }
  }

  // -- 8. Flood efficiency ---------------------------------------------
  const { avgOpensPerClick } = stats;
  if (avgOpensPerClick !== null && stats.gamesWithActions >= 5) {
    if (avgOpensPerClick >= 4) {
      out.push({
        id: "flood_master",
        tone: "good",
        title: "Flood reader",
        body: `Each click pops ${avgOpensPerClick.toFixed(
          1,
        )} cells on average — you're chaining big openings instead of nibbling. Keep going.`,
        weight: 5,
      });
    } else if (avgOpensPerClick < 1.6) {
      out.push({
        id: "flood_tight",
        tone: "neutral",
        title: "Tight clicks",
        body: `Just ${avgOpensPerClick.toFixed(
          1,
        )} cells per click. You're playing it safe and nibbling reveals — chord-click satisfied numbers to unlock big floods.`,
        weight: 4,
      });
    }
  }

  // -- Sort by weight, cap at 6 -----------------------------------------
  return out.sort((a, b) => b.weight - a.weight).slice(0, 6);
}
