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

/** Full premium track span — free tier shows this entire bar with a lock at 40 Hz. */
export function beatHzSliderTrackLimits(): {min: number; max: number} {
  return {min: MIN_BEAT_HZ_PREMIUM, max: MAX_BEAT_HZ_PREMIUM};
}

/** Hz values the user may set for their tier (interaction clamp). */
export function beatHzInteractionLimitsForTier(tier: SubscriptionTier): {min: number; max: number} {
  if (isPremiumUnlocked(tier)) {
    return {min: MIN_BEAT_HZ_PREMIUM, max: MAX_BEAT_HZ_PREMIUM};
  }
  return {min: MIN_BEAT_HZ_FREE, max: MAX_BEAT_HZ};
}

export function beatHzLimitsForTier(tier: SubscriptionTier): {min: number; max: number} {
  return beatHzInteractionLimitsForTier(tier);
}

function mapHzToTrackNorm(hz: number, scale: BeatSliderScale): number {
  const {min, max} = beatHzSliderTrackLimits();
  const clamped = Math.min(max, Math.max(min, hz));
  if (scale === 'linear') {
    return (clamped - min) / (max - min);
  }
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(clamped) - logMin) / (logMax - logMin);
}

function mapTrackNormToHz(norm: number, scale: BeatSliderScale): number {
  const {min, max} = beatHzSliderTrackLimits();
  const n = Math.min(1, Math.max(0, norm));
  if (scale === 'linear') {
    return min + n * (max - min);
  }
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + n * (logMax - logMin));
}

/** Normalized position of the free-tier cap (40 Hz) on the full premium track. */
export function beatHzFreeCapNorm(scale: BeatSliderScale = 'exponential'): number {
  return mapHzToTrackNorm(MAX_BEAT_HZ, scale);
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
  const {min, max} = beatHzInteractionLimitsForTier(tier);
  const clamped = Math.min(max, Math.max(min, hz));
  return mapHzToTrackNorm(clamped, scale);
}

export function sliderNormToBeatHz(
  norm: number,
  tier: SubscriptionTier,
  scale: BeatSliderScale = 'exponential',
): number {
  const {min, max} = beatHzInteractionLimitsForTier(tier);
  const hz = mapTrackNormToHz(norm, scale);
  return Math.min(max, Math.max(min, hz));
}
