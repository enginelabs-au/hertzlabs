export const MIN_BEAT_HZ = 10;
export const MAX_BEAT_HZ = 40;
export const MAX_BEAT_HZ_PREMIUM = 100;
export const PEAK_CEILING_LINEAR = 0.5011872336;
export const MIN_RAMP_MS = 50;
export const MAX_RAMP_MS = 100;
export const DEFAULT_RAMP_MS = 75;

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

export function clampBeatHz(beatHz: number, tier?: 'free' | 'premium'): number {
  const max = tier === 'premium' ? MAX_BEAT_HZ_PREMIUM : MAX_BEAT_HZ;
  return clampNumber(beatHz, MIN_BEAT_HZ, max, MIN_BEAT_HZ);
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

export function sanitizeBinauralParameters(params: BinauralParameters): BinauralParameters {
  const beatHz = clampBeatHz(params.beatHz);
  const carrierHz = clampNumber(params.carrierHz, MAX_BEAT_HZ, 20000, 220);

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

export function getStereoFrequencies(carrierHz: number, beatHz: number): StereoFrequencies {
  const sanitizedBeatHz = clampBeatHz(beatHz);
  const sanitizedCarrierHz = clampNumber(carrierHz, MAX_BEAT_HZ, 20000, 220);

  return {
    leftHz: sanitizedCarrierHz - sanitizedBeatHz / 2,
    rightHz: sanitizedCarrierHz + sanitizedBeatHz / 2,
  };
}
