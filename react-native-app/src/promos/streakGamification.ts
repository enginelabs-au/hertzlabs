/** Streak tier / badge MVP (Feature 15). */

export type StreakTierId = 'ember' | 'spark' | 'flame' | 'blaze';

export type StreakTier = {
  id: StreakTierId;
  label: string;
  emoji: string;
  minDays: number;
  description: string;
};

export const STREAK_TIERS: StreakTier[] = [
  {id: 'ember', label: 'Ember', emoji: '🕯️', minDays: 1, description: 'First steps — keep showing up.'},
  {id: 'spark', label: 'Spark', emoji: '✨', minDays: 7, description: 'A week of consistency.'},
  {id: 'flame', label: 'Flame', emoji: '🔥', minDays: 30, description: 'Deep habit forming.'},
  {id: 'blaze', label: 'Blaze', emoji: '⚡', minDays: 60, description: 'Elite daily ritual.'},
];

export const STREAK_SHIELD_GRANT_INTERVAL_DAYS = 30;

export function streakTierForDays(streakDays: number): StreakTier {
  let tier = STREAK_TIERS[0];
  for (const candidate of STREAK_TIERS) {
    if (streakDays >= candidate.minDays) {
      tier = candidate;
    }
  }
  return tier;
}

export function nextStreakTier(streakDays: number): StreakTier | null {
  for (const tier of STREAK_TIERS) {
    if (streakDays < tier.minDays) {
      return tier;
    }
  }
  return null;
}

/** Shields granted on tier milestones + every 30 qualifying days while active. */
export function shieldsEarnedForStreak(streakDays: number): number {
  let shields = 1;
  if (streakDays >= 7) {
    shields += 1;
  }
  if (streakDays >= 30) {
    shields += 1;
  }
  shields += Math.floor(streakDays / STREAK_SHIELD_GRANT_INTERVAL_DAYS);
  return shields;
}
