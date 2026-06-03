import {describe, expect, it, vi} from 'vitest';

vi.mock('../src/monetization/isPremiumUnlocked', () => ({
  FORCED_V1_TEST_UNLOCK: false,
  isPremiumUnlocked: (tier: string) => tier === 'premium',
}));

import {
  MIN_BEAT_HZ_FREE,
  MIN_BEAT_HZ_PREMIUM,
  MAX_BEAT_HZ,
  MAX_BEAT_HZ_PREMIUM,
  PEAK_CEILING_LINEAR,
  MIN_RAMP_MS,
  MAX_RAMP_MS,
  DEFAULT_RAMP_MS,
  clampNumber,
  clampBeatHz,
  clampGain,
  clampBalance,
  clampRampMs,
  sanitizeBinauralParameters,
  getStereoFrequencies,
  type BinauralParameters,
} from '../src/audio/paramMapping';

const baseParams: BinauralParameters = {
  carrierHz: 220,
  beatHz: 10,
  gain: 0.2,
  balance: 0,
  noiseType: 'none',
  noiseLevel: 0,
  fadeMs: DEFAULT_RAMP_MS,
};

describe('constants match Plan 05 monetization', () => {
  it('pins the -6 dBFS linear ceiling to 0.5011872336', () => {
    expect(PEAK_CEILING_LINEAR).toBe(0.5011872336);
    expect(PEAK_CEILING_LINEAR).toBeCloseTo(Math.pow(10, -6 / 20), 9);
  });

  it('pins beat clamp spans', () => {
    expect(MIN_BEAT_HZ_FREE).toBe(0.5);
    expect(MIN_BEAT_HZ_PREMIUM).toBe(0.05);
    expect(MAX_BEAT_HZ).toBe(40);
    expect(MAX_BEAT_HZ_PREMIUM).toBe(500);
    expect([MIN_RAMP_MS, DEFAULT_RAMP_MS, MAX_RAMP_MS]).toEqual([50, 75, 100]);
  });
});

describe('clampBeatHz', () => {
  it('keeps in-range beat frequencies on free tier', () => {
    expect(clampBeatHz(2)).toBe(2);
    expect(clampBeatHz(25)).toBe(25);
    expect(clampBeatHz(40)).toBe(40);
  });

  it('clamps free tier below 0.5 Hz to floor', () => {
    expect(clampBeatHz(0.2)).toBe(MIN_BEAT_HZ_FREE);
    expect(clampBeatHz(0.05)).toBe(MIN_BEAT_HZ_FREE);
  });

  it('clamps free tier above 40 Hz', () => {
    expect(clampBeatHz(100)).toBe(40);
  });

  it('allows epsilon and lambda on premium tier', () => {
    expect(clampBeatHz(0.2, 'premium')).toBe(0.2);
    expect(clampBeatHz(0.05, 'premium')).toBe(0.05);
    expect(clampBeatHz(120, 'premium')).toBe(120);
    expect(clampBeatHz(400, 'premium')).toBe(400);
  });

  it('falls back to premium min for non-finite input on premium', () => {
    expect(clampBeatHz(NaN, 'premium')).toBe(MIN_BEAT_HZ_PREMIUM);
  });
});

describe('sanitizeBinauralParameters', () => {
  it('clamps beat and carrier into valid ranges', () => {
    const out = sanitizeBinauralParameters({
      ...baseParams,
      beatHz: 500,
      carrierHz: 10,
    });
    expect(out.beatHz).toBe(MAX_BEAT_HZ);
    expect(out.carrierHz).toBe(20);
  });
});

describe('getStereoFrequencies', () => {
  it('splits carrier into L/R tones', () => {
    const {leftHz, rightHz} = getStereoFrequencies(220, 10);
    expect(leftHz).toBe(215);
    expect(rightHz).toBe(225);
  });
});
