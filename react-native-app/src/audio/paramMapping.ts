import type {SubscriptionTier} from '../state/types';
import {channelFrequencies} from './channelFrequencies';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';

/** Plan 05 — free tier floor (Delta+); premium reaches Epsilon below this. */
export const MIN_BEAT_HZ_FREE = 0.5;
/** Epsilon band floor (0–0.5 Hz) when premium unlocked. */
export const MIN_BEAT_HZ_PREMIUM = 0.05;
export const MAX_BEAT_HZ = 40;
/** Plan 05 premium — Lambda (100+) and experimental range. */
export const MAX_BEAT_HZ_PREMIUM = 500;

/**
 * Human-audible spectrum bounds for Experimental mode. The Ω− / Ω+ dials sweep
 * the produced PITCH (carrier) across this window: the Ω− dial floors at 20 Hz
 * (low edge of hearing) and the Ω+ dial ceilings at 20 kHz (high edge), so the
 * tone is never taken below audible. The binaural BEAT stays a separate control
 * (the main slider, on the normal tier range).
 */
export const AUDIBLE_FLOOR_HZ = 20;
export const AUDIBLE_CEILING_HZ = 20_000;

/**
 * Native DSP safety span for the binaural BEAT (the differential between ears).
 * The engine accepts a very wide finite range so nothing clips at the DSP layer;
 * the user-facing beat slider stays on the normal tier range (see clampBeatHz).
 */
export const ABS_MIN_BEAT_HZ = 1e-18;
export const MAX_BEAT_HZ_ULTRASONIC = 1_000_000;
export const MAX_BEAT_HZ_EXPERIMENTAL = MAX_BEAT_HZ_ULTRASONIC;
/**
 * Experimental carrier (PITCH) ceiling — the Ω+ dial raises the produced tone up
 * to the top of human hearing (20 kHz), above the normal MAX_CARRIER_HZ. The
 * floor stays MIN_CARRIER_HZ (20 Hz), so the tone never goes sub-audible.
 */
export const MAX_CARRIER_HZ_EXPERIMENTAL = AUDIBLE_CEILING_HZ;

/** @deprecated Use MIN_BEAT_HZ_PREMIUM or minBeatHzForTier */
export const MIN_BEAT_HZ = MIN_BEAT_HZ_PREMIUM;

export const PEAK_CEILING_LINEAR = 0.5011872336;
export const MIN_RAMP_MS = 50;
export const MAX_RAMP_MS = 100;
export const DEFAULT_RAMP_MS = 75;
export const MIN_CARRIER_HZ = 20;
export const MAX_CARRIER_HZ = 1500;

/**
 * Tap-to-reset defaults — tapping a dial/slider without dragging snaps it here.
 * `DEFAULT_VOLUME_GAIN` is the −6 dBFS safety ceiling (the "6 dB" reset target).
 * `DEFAULT_CARRIER_HZ` is the audible pitch the Experimental Ω−/Ω+ dials reset to.
 */
export const DEFAULT_BEAT_HZ = 10;
export const DEFAULT_CARRIER_HZ = 220;
export const DEFAULT_PHASE_DEG = 0;
export const DEFAULT_DRIFT_HZ = 0;
export const DEFAULT_VOLUME_GAIN = PEAK_CEILING_LINEAR;

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

/**
 * Clamp the binaural BEAT (the L/R differential) to the tier range. This is the
 * same in normal and Experimental mode — Experimental only widens the PITCH
 * (carrier, via the Ω−/Ω+ dials), not the beat, so the "slider beat speed" still
 * reaches the normal low end (≈0.05 Hz premium).
 */
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
  experimental = false,
): BinauralParameters {
  const beatHz = clampBeatHz(params.beatHz, tier);
  // Store the user-facing carrier; L/R proportional centering happens in
  // channelFrequencies when mapping to native / the visualizer. Experimental mode
  // raises the carrier ceiling to the audible top (20 kHz) for the pitch dials.
  const carrierMax = experimental ? MAX_CARRIER_HZ_EXPERIMENTAL : MAX_CARRIER_HZ;
  const carrierHz = clampNumber(params.carrierHz, MIN_CARRIER_HZ, carrierMax, 220);

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
  experimental = false,
): StereoFrequencies {
  const sanitizedBeatHz = clampBeatHz(beatHz, tier);
  const carrierMax = experimental ? MAX_CARRIER_HZ_EXPERIMENTAL : MAX_CARRIER_HZ;
  const sanitizedCarrierHz = clampNumber(carrierHz, MIN_CARRIER_HZ, carrierMax, 220);
  const {leftHz, rightHz} = channelFrequencies(
    sanitizedCarrierHz,
    sanitizedBeatHz,
    0,
    0,
  );

  return {leftHz, rightHz};
}
