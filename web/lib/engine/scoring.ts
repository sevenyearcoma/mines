import type { RoundEndReason, ScoreBreakdown } from "./types";

// Score is a per-reveal state machine, not a roll-up of final counts.
//
// Rules:
//   * Only REVEAL actions (single-click reveal + chord cascades) earn points.
//   * Flagging is a personal-logic action and must not change score, because
//     a live-score feedback channel would otherwise leak "is this a mine".
//   * Each reveal grows a multiplier (streak), with bonus jumps for big
//     flood-fills (combo). Hesitation between reveals resets the multiplier.
//   * Speed bonus is realised at round end, only on a clean win.
export const SCORE_CONSTANTS = {
  BASE_PER_OPEN: 10,
  STREAK_GROWTH: 0.05,
  COMBO_THRESHOLD: 4,
  COMBO_BUMP: 0.5,
  HESITATION_MS: 1500,
  MAX_MULTIPLIER: 5.0,
  SPEED_FULL_BONUS: 2000,
  SPEED_DECAY_MS: 120_000,
} as const;

export interface ScoreState {
  rawPoints: number;       // sum of revealedCount * BASE, no multiplier
  earnedPoints: number;    // sum of revealedCount * BASE * multiplier
  streak: number;          // consecutive non-hesitating reveals
  multiplier: number;      // current multiplier — keeps accumulated combo bumps
  lastRevealAt: number;    // ms since round start of the last reveal, -1 = none
  peakStreak: number;
  peakMultiplier: number;
}

export function newScoreState(): ScoreState {
  return {
    rawPoints: 0,
    earnedPoints: 0,
    streak: 0,
    multiplier: 1.0,
    lastRevealAt: -1,
    peakStreak: 0,
    peakMultiplier: 1.0,
  };
}

// Apply a reveal event. revealedCount is the number of safe cells uncovered
// by this single action (flood-fill expansion counts as one event because the
// player committed one click). atMs is the ms since round start of the click.
export function applyReveal(
  state: ScoreState,
  revealedCount: number,
  atMs: number,
): ScoreState {
  if (revealedCount <= 0) return state;

  const {
    BASE_PER_OPEN,
    STREAK_GROWTH,
    COMBO_THRESHOLD,
    COMBO_BUMP,
    HESITATION_MS,
    MAX_MULTIPLIER,
  } = SCORE_CONSTANTS;

  const isFirst = state.lastRevealAt < 0;
  const gap = isFirst ? 0 : atMs - state.lastRevealAt;
  const hesitated = !isFirst && gap >= HESITATION_MS;

  // Hesitation breaks the chain: streak + multiplier reset to fresh-start.
  // Otherwise streak ticks up and multiplier inherits previous combo bumps.
  let nextStreak: number;
  let nextMult: number;
  if (hesitated || isFirst) {
    nextStreak = 1;
    nextMult = 1.0;
  } else {
    nextStreak = state.streak + 1;
    nextMult = state.multiplier + STREAK_GROWTH;
  }
  if (revealedCount >= COMBO_THRESHOLD) {
    nextMult += COMBO_BUMP;
  }
  if (nextMult > MAX_MULTIPLIER) nextMult = MAX_MULTIPLIER;

  const raw = revealedCount * BASE_PER_OPEN;
  const earned = Math.round(raw * nextMult);

  return {
    rawPoints: state.rawPoints + raw,
    earnedPoints: state.earnedPoints + earned,
    streak: nextStreak,
    multiplier: nextMult,
    lastRevealAt: atMs,
    peakStreak: Math.max(state.peakStreak, nextStreak),
    peakMultiplier: Math.max(state.peakMultiplier, nextMult),
  };
}

// Build the final breakdown from accumulated state. Speed bonus only counts
// on a clean win — exploding or timing out doesn't pay out for being fast.
export function finalizeScore(
  state: ScoreState,
  elapsedMs: number,
  reason: RoundEndReason,
): ScoreBreakdown {
  const { SPEED_FULL_BONUS, SPEED_DECAY_MS } = SCORE_CONSTANTS;

  const base = state.rawPoints;
  const combo = Math.max(0, state.earnedPoints - state.rawPoints);
  const speed =
    reason === "won"
      ? Math.max(
          0,
          Math.round(SPEED_FULL_BONUS * (1 - elapsedMs / SPEED_DECAY_MS)),
        )
      : 0;
  const total = Math.max(0, base + combo + speed);
  return {
    base,
    combo,
    speed,
    peakStreak: state.peakStreak,
    peakMultiplier: state.peakMultiplier,
    total,
  };
}
