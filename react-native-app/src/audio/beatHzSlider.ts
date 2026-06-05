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

/** How normalized slider position [0, 1] maps to beat Hz. */
export type BeatSliderScale = 'linear' | 'exponential';

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

/** UI-thread worklet code: 0 = linear, 1 = exponential (log). */
export function beatSliderScaleToWorklet(scale: BeatSliderScale): number {
  return scale === 'linear' ? 0 : 1;
}

export function beatHzToSliderNorm(
  hz: number,
  tier: SubscriptionTier,
  scale: BeatSliderScale = 'exponential',
): number {
  const {min, max} = beatHzLimitsForTier(tier);
  const clamped = Math.min(max, Math.max(min, hz));
  if (scale === 'linear') {
    return (clamped - min) / (max - min);
  }
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(clamped) - logMin) / (logMax - logMin);
}

export function sliderNormToBeatHz(
  norm: number,
  tier: SubscriptionTier,
  scale: BeatSliderScale = 'exponential',
): number {
  const {min, max} = beatHzLimitsForTier(tier);
  const n = Math.min(1, Math.max(0, norm));
  if (scale === 'linear') {
    return min + n * (max - min);
  }
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + n * (logMax - logMin));
}
