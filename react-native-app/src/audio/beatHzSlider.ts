import type {SubscriptionTier} from '../state/types';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {
  MAX_BEAT_HZ,
  MAX_BEAT_HZ_PREMIUM,
  MIN_BEAT_HZ_FREE,
  MIN_BEAT_HZ_PREMIUM,
} from './paramMapping';

/** Lambda band begins at 100 Hz (Plan 03 brainwave table). */
export const LAMBDA_BAND_MIN_HZ = 100;

export function beatHzLimitsForTier(tier: SubscriptionTier): {min: number; max: number} {
  if (isPremiumUnlocked(tier)) {
    return {min: MIN_BEAT_HZ_PREMIUM, max: MAX_BEAT_HZ_PREMIUM};
  }
  return {min: MIN_BEAT_HZ_FREE, max: MAX_BEAT_HZ};
}

export function maxBeatHzForTier(tier: SubscriptionTier): number {
  return beatHzLimitsForTier(tier).max;
}

export function minBeatHzForTier(tier: SubscriptionTier): number {
  return beatHzLimitsForTier(tier).min;
}

/**
 * Logarithmic slider so Epsilon (&lt;1 Hz) and Lambda (100+ Hz) are reachable on one control.
 */
export function beatHzToSliderNorm(hz: number, tier: SubscriptionTier): number {
  const {min, max} = beatHzLimitsForTier(tier);
  const clamped = Math.min(max, Math.max(min, hz));
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(clamped) - logMin) / (logMax - logMin);
}

export function sliderNormToBeatHz(norm: number, tier: SubscriptionTier): number {
  const {min, max} = beatHzLimitsForTier(tier);
  const n = Math.min(1, Math.max(0, norm));
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + n * (logMax - logMin));
}
