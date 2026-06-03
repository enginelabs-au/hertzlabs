import type {SubscriptionTier} from '../state/types';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';

/** Plan 05 — free tier floor (Delta+); premium reaches Epsilon below this. */
export const MIN_BEAT_HZ_FREE = 0.5;
/** Epsilon band floor (0–0.5 Hz) when premium unlocked. */
export const MIN_BEAT_HZ_PREMIUM = 0.05;
export const MAX_BEAT_HZ = 40;
/** Plan 05 premium — Lambda (100+) and experimental range. */
export const MAX_BEAT_HZ_PREMIUM = 500;

/** @deprecated Use MIN_BEAT_HZ_PREMIUM or minBeatHzForTier */
export const MIN_BEAT_HZ = MIN_BEAT_HZ_PREMIUM;

export const PEAK_CEILING_LINEAR = 0.5011872336;
export const MIN_RAMP_MS = 50;
export const MAX_RAMP_MS = 100;
export const DEFAULT_RAMP_MS = 75;
export const MIN_CARRIER_HZ = 20;
export const MAX_CARRIER_HZ = 1500;

export type Waveform = 'sine' | 'square' | 'triangle';
export type NoiseType = 'none' | 'white' | 'pink' | 'brown';

export type BinauralParameters = {
  carrierHz: number;
  beatHz: number;
  gain: number;
  balance: number;
  noiseType: NoiseType;
  noiseLevel: number;
  fadeMs: number;
};

export type StereoFrequencies = {
  leftHz: number;
  rightHz: number;
};

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

export function clampBeatHz(beatHz: number, tier: SubscriptionTier = 'free'): number {
  if (isPremiumUnlocked(tier)) {
    return clampNumber(beatHz, MIN_BEAT_HZ_PREMIUM, MAX_BEAT_HZ_PREMIUM, MIN_BEAT_HZ_PREMIUM);
  }
  return clampNumber(beatHz, MIN_BEAT_HZ_FREE, MAX_BEAT_HZ, MIN_BEAT_HZ_FREE);
}

export function clampGain(gain: number): number {
  return clampNumber(gain, 0, PEAK_CEILING_LINEAR, 0);
}

export function clampBalance(balance: number): number {
  return clampNumber(balance, -1, 1, 0);
}

export function clampRampMs(rampMs: number): number {
  return clampNumber(rampMs, MIN_RAMP_MS, MAX_RAMP_MS, DEFAULT_RAMP_MS);
}

export function sanitizeBinauralParameters(
  params: BinauralParameters,
  tier: SubscriptionTier = 'free',
): BinauralParameters {
  const beatHz = clampBeatHz(params.beatHz, tier);
  const carrierHz = clampNumber(params.carrierHz, MIN_CARRIER_HZ, MAX_CARRIER_HZ, 220);

  return {
    ...params,
    carrierHz,
    beatHz,
    gain: clampGain(params.gain),
    balance: clampBalance(params.balance),
    noiseLevel: clampGain(params.noiseLevel),
    fadeMs: clampRampMs(params.fadeMs),
  };
}

export function getStereoFrequencies(
  carrierHz: number,
  beatHz: number,
  tier: SubscriptionTier = 'free',
): StereoFrequencies {
  const sanitizedBeatHz = clampBeatHz(beatHz, tier);
  const sanitizedCarrierHz = clampNumber(carrierHz, MIN_CARRIER_HZ, MAX_CARRIER_HZ, 220);

  return {
    leftHz: sanitizedCarrierHz - sanitizedBeatHz / 2,
    rightHz: sanitizedCarrierHz + sanitizedBeatHz / 2,
  };
}
