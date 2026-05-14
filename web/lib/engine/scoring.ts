import type { RoundEndReason, ScoreBreakdown } from "./types";

// Score is a per-reveal state machine, not a roll-up of final counts.
//
// Rules:
//   * Only clean REVEAL actions earn points.
//   * Flagging is a personal-logic action and must not change score, because
//     a live-score feedback channel would otherwise leak "is this a mine".
//   * Speed and accuracy are separate multipliers. Speed rewards fast chained
//     reveals; accuracy rewards consecutive safe actions even if the player
//     slows down. Each lane caps at 3x.
//   * Mine hits are mistakes: they reset both combo lanes, cost HP, and stun
//     input. The round only ends after the last life is lost.
//   * Speed bonus is realised at round end, only on a clean win.
export const SCORE_CONSTANTS = {
  BASE_PER_OPEN: 10,

  SPEED_FAST_MS: 650,
  HESITATION_MS: 1500,
  SPEED_GROWTH_FAST: 0.12,
  SPEED_GROWTH_STEADY: 0.06,
  COMBO_THRESHOLD: 4,
  SPEED_COMBO_BUMP: 0.5,
  SPEED_COMBO_BUMP_PER_EXTRA_CELL: 0.04,
  SPEED_COMBO_BUMP_MAX: 1.35,
  SPEED_MILESTONE_EVERY: 5,
  SPEED_MILESTONE_BUMP: 0.15,
  SPEED_MAX_MULTIPLIER: 3.0,

  ACCURACY_GROWTH: 0.075,
  ACCURACY_CASCADE_BUMP_PER_CELL: 0.008,
  ACCURACY_CASCADE_BUMP_MAX: 0.12,
  ACCURACY_MAX_MULTIPLIER: 3.0,

  MAX_LIVES: 3,
  MISTAKE_STUN_MS: 3000,

  SPEED_FULL_BONUS: 2000,
  SPEED_DECAY_MS: 120_000,
} as const;

export interface ScoreState {
  rawPoints: number;          // sum of revealedCount * BASE, no multiplier
  earnedPoints: number;       // sum of revealedCount * BASE * total multiplier
  streak: number;             // current speed streak (resets on hesitation)
  accuracyStreak: number;     // current clean-action streak (resets on mistake)
  multiplier: number;         // speedMultiplier * accuracyMultiplier
  speedMultiplier: number;
  accuracyMultiplier: number;
  lastRevealAt: number;       // ms since round start of the last reveal, -1 = none
  peakStreak: number;
  peakAccuracyStreak: number;
  peakMultiplier: number;
  peakSpeedMultiplier: number;
  peakAccuracyMultiplier: number;
  mistakes: number;
}

export interface RevealScoreFeedback {
  revealedCount: number;
  rawPoints: number;
  earnedPoints: number;
  comboPoints: number;
  previousStreak: number;
  previousAccuracyStreak: number;
  previousMultiplier: number;
  previousSpeedMultiplier: number;
  previousAccuracyMultiplier: number;
  streak: number;
  accuracyStreak: number;
  multiplier: number;
  speedMultiplier: number;
  accuracyMultiplier: number;
  hesitated: boolean;
  speedCascadeBonus: number;
  speedMilestoneBonus: number;
  accuracyBonus: number;
  tier: 0 | 1 | 2 | 3;
}

export interface MistakeScoreFeedback {
  previousStreak: number;
  previousAccuracyStreak: number;
  previousMultiplier: number;
  previousSpeedMultiplier: number;
  previousAccuracyMultiplier: number;
  streak: number;
  accuracyStreak: number;
  multiplier: number;
  speedMultiplier: number;
  accuracyMultiplier: number;
  mistakes: number;
}

export function newScoreState(): ScoreState {
  return {
    rawPoints: 0,
    earnedPoints: 0,
    streak: 0,
    accuracyStreak: 0,
    multiplier: 1.0,
    speedMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    lastRevealAt: -1,
    peakStreak: 0,
    peakAccuracyStreak: 0,
    peakMultiplier: 1.0,
    peakSpeedMultiplier: 1.0,
    peakAccuracyMultiplier: 1.0,
    mistakes: 0,
  };
}

// Apply a clean reveal event. revealedCount is the number of safe cells
// uncovered by this single action. atMs is the ms since round start.
export function applyReveal(
  state: ScoreState,
  revealedCount: number,
  atMs: number,
): ScoreState {
  return applyRevealWithFeedback(state, revealedCount, atMs).state;
}

export function applyRevealWithFeedback(
  state: ScoreState,
  revealedCount: number,
  atMs: number,
): { state: ScoreState; feedback: RevealScoreFeedback } {
  if (revealedCount <= 0) {
    return {
      state,
      feedback: {
        revealedCount,
        rawPoints: 0,
        earnedPoints: 0,
        comboPoints: 0,
        previousStreak: state.streak,
        previousAccuracyStreak: state.accuracyStreak,
        previousMultiplier: state.multiplier,
        previousSpeedMultiplier: state.speedMultiplier,
        previousAccuracyMultiplier: state.accuracyMultiplier,
        streak: state.streak,
        accuracyStreak: state.accuracyStreak,
        multiplier: state.multiplier,
        speedMultiplier: state.speedMultiplier,
        accuracyMultiplier: state.accuracyMultiplier,
        hesitated: false,
        speedCascadeBonus: 0,
        speedMilestoneBonus: 0,
        accuracyBonus: 0,
        tier: 0,
      },
    };
  }

  const {
    BASE_PER_OPEN,
    SPEED_FAST_MS,
    HESITATION_MS,
    SPEED_GROWTH_FAST,
    SPEED_GROWTH_STEADY,
    COMBO_THRESHOLD,
    SPEED_COMBO_BUMP,
    SPEED_COMBO_BUMP_PER_EXTRA_CELL,
    SPEED_COMBO_BUMP_MAX,
    SPEED_MILESTONE_EVERY,
    SPEED_MILESTONE_BUMP,
    SPEED_MAX_MULTIPLIER,
    ACCURACY_GROWTH,
    ACCURACY_CASCADE_BUMP_PER_CELL,
    ACCURACY_CASCADE_BUMP_MAX,
    ACCURACY_MAX_MULTIPLIER,
  } = SCORE_CONSTANTS;

  const isFirst = state.lastRevealAt < 0;
  const gap = isFirst ? 0 : atMs - state.lastRevealAt;
  const hesitated = !isFirst && gap >= HESITATION_MS;

  const nextStreak = hesitated || isFirst ? 1 : state.streak + 1;
  let nextSpeedMult = hesitated || isFirst
    ? 1.0
    : state.speedMultiplier + (gap <= SPEED_FAST_MS ? SPEED_GROWTH_FAST : SPEED_GROWTH_STEADY);

  let speedCascadeBonus = 0;
  if (revealedCount >= COMBO_THRESHOLD) {
    speedCascadeBonus = Math.min(
      SPEED_COMBO_BUMP_MAX,
      SPEED_COMBO_BUMP +
        (revealedCount - COMBO_THRESHOLD) * SPEED_COMBO_BUMP_PER_EXTRA_CELL,
    );
    nextSpeedMult += speedCascadeBonus;
  }

  const speedMilestoneBonus =
    !hesitated &&
    nextStreak > 0 &&
    nextStreak % SPEED_MILESTONE_EVERY === 0
      ? SPEED_MILESTONE_BUMP
      : 0;
  nextSpeedMult += speedMilestoneBonus;
  nextSpeedMult = clamp(nextSpeedMult, 1, SPEED_MAX_MULTIPLIER);

  const nextAccuracyStreak = state.accuracyStreak + 1;
  const accuracyBonus =
    ACCURACY_GROWTH +
    Math.min(
      ACCURACY_CASCADE_BUMP_MAX,
      Math.max(0, revealedCount - 1) * ACCURACY_CASCADE_BUMP_PER_CELL,
    );
  const nextAccuracyMult = clamp(
    state.accuracyMultiplier + accuracyBonus,
    1,
    ACCURACY_MAX_MULTIPLIER,
  );
  const nextTotalMult = nextSpeedMult * nextAccuracyMult;

  const raw = revealedCount * BASE_PER_OPEN;
  const earned = Math.round(raw * nextTotalMult);
  const comboPoints = Math.max(0, earned - raw);
  const tier = comboTier(
    nextTotalMult,
    nextSpeedMult,
    nextAccuracyMult,
    revealedCount,
    speedCascadeBonus,
    speedMilestoneBonus,
  );

  const nextState = {
    rawPoints: state.rawPoints + raw,
    earnedPoints: state.earnedPoints + earned,
    streak: nextStreak,
    accuracyStreak: nextAccuracyStreak,
    multiplier: nextTotalMult,
    speedMultiplier: nextSpeedMult,
    accuracyMultiplier: nextAccuracyMult,
    lastRevealAt: atMs,
    peakStreak: Math.max(state.peakStreak, nextStreak),
    peakAccuracyStreak: Math.max(state.peakAccuracyStreak, nextAccuracyStreak),
    peakMultiplier: Math.max(state.peakMultiplier, nextTotalMult),
    peakSpeedMultiplier: Math.max(state.peakSpeedMultiplier, nextSpeedMult),
    peakAccuracyMultiplier: Math.max(
      state.peakAccuracyMultiplier,
      nextAccuracyMult,
    ),
    mistakes: state.mistakes,
  };

  return {
    state: nextState,
    feedback: {
      revealedCount,
      rawPoints: raw,
      earnedPoints: earned,
      comboPoints,
      previousStreak: state.streak,
      previousAccuracyStreak: state.accuracyStreak,
      previousMultiplier: state.multiplier,
      previousSpeedMultiplier: state.speedMultiplier,
      previousAccuracyMultiplier: state.accuracyMultiplier,
      streak: nextStreak,
      accuracyStreak: nextAccuracyStreak,
      multiplier: nextTotalMult,
      speedMultiplier: nextSpeedMult,
      accuracyMultiplier: nextAccuracyMult,
      hesitated,
      speedCascadeBonus,
      speedMilestoneBonus,
      accuracyBonus,
      tier,
    },
  };
}

export function applyMistake(
  state: ScoreState,
  atMs: number,
): { state: ScoreState; feedback: MistakeScoreFeedback } {
  const nextState = {
    ...state,
    streak: 0,
    accuracyStreak: 0,
    multiplier: 1.0,
    speedMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    lastRevealAt: atMs,
    mistakes: state.mistakes + 1,
  };

  return {
    state: nextState,
    feedback: {
      previousStreak: state.streak,
      previousAccuracyStreak: state.accuracyStreak,
      previousMultiplier: state.multiplier,
      previousSpeedMultiplier: state.speedMultiplier,
      previousAccuracyMultiplier: state.accuracyMultiplier,
      streak: nextState.streak,
      accuracyStreak: nextState.accuracyStreak,
      multiplier: nextState.multiplier,
      speedMultiplier: nextState.speedMultiplier,
      accuracyMultiplier: nextState.accuracyMultiplier,
      mistakes: nextState.mistakes,
    },
  };
}

function comboTier(
  totalMultiplier: number,
  speedMultiplier: number,
  accuracyMultiplier: number,
  revealedCount: number,
  speedCascadeBonus: number,
  speedMilestoneBonus: number,
): 0 | 1 | 2 | 3 {
  if (
    totalMultiplier >= 4.5 ||
    speedMultiplier >= 2.6 ||
    accuracyMultiplier >= 2.45 ||
    revealedCount >= 14 ||
    speedCascadeBonus >= 0.9 ||
    speedMilestoneBonus > 0
  ) {
    return 3;
  }
  if (
    totalMultiplier >= 2.8 ||
    speedMultiplier >= 1.8 ||
    accuracyMultiplier >= 1.75 ||
    revealedCount >= 8 ||
    speedCascadeBonus >= 0.55
  ) {
    return 2;
  }
  if (
    totalMultiplier > 1.1 ||
    speedMultiplier > 1.001 ||
    accuracyMultiplier > 1.001 ||
    revealedCount >= SCORE_CONSTANTS.COMBO_THRESHOLD
  ) {
    return 1;
  }
  return 0;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

// Build the final breakdown from accumulated state. Speed bonus only counts
// on a clean win; exploding or timing out does not pay out for being fast.
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
    peakAccuracyStreak: state.peakAccuracyStreak,
    peakMultiplier: state.peakMultiplier,
    peakSpeedMultiplier: state.peakSpeedMultiplier,
    peakAccuracyMultiplier: state.peakAccuracyMultiplier,
    mistakes: state.mistakes,
    total,
  };
}
