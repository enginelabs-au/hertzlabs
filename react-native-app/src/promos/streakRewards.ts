/** Streak milestone rewards (Promos screen). */

export const STREAK_REWARD_7_DAYS = 3;
export const STREAK_REWARD_30_DAYS = 7;
export const STREAK_BONUS_INTERVAL = 10;
export const STREAK_BONUS_START = 40;
export const STREAK_BONUS_DAYS = 3;

export function streakBonusMilestonesUpTo(streakDays: number): number[] {
  if (streakDays < STREAK_BONUS_START) {
    return [];
  }
  const out: number[] = [];
  for (let day = STREAK_BONUS_START; day <= streakDays; day += STREAK_BONUS_INTERVAL) {
    out.push(day);
  }
  return out;
}

export function nextUnclaimedStreakBonus(
  streakDays: number,
  claimed: number[],
): number | null {
  const claimedSet = new Set(claimed);
  for (const day of streakBonusMilestonesUpTo(streakDays)) {
    if (!claimedSet.has(day)) {
      return day;
    }
  }
  return null;
}

export function streakBonusProgress(streakDays: number, targetMilestone: number): {
  current: number;
  target: number;
} {
  const prev =
    targetMilestone === STREAK_BONUS_START
      ? 30
      : targetMilestone - STREAK_BONUS_INTERVAL;
  const span = targetMilestone - prev;
  const current = Math.max(0, Math.min(span, streakDays - prev));
  return {current, target: span};
}
