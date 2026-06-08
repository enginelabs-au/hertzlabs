import {describe, expect, it, vi} from 'vitest';

vi.mock('../src/monetization/isPremiumUnlocked', () => ({
  FORCED_V1_TEST_UNLOCK: false,
  isPremiumUnlocked: (tier: string) => tier === 'premium',
}));

import {
  beatHzFreeCapNorm,
  beatHzToSliderNorm,
  sliderNormToBeatHz,
} from '../src/audio/beatHzSlider';
import {MAX_BEAT_HZ, MAX_BEAT_HZ_PREMIUM, MIN_BEAT_HZ_PREMIUM} from '../src/audio/paramMapping';

describe('beatHzSlider exponential (log) mapping', () => {
  it('maps epsilon and lambda within premium range', () => {
    const tier = 'premium' as const;
    expect(sliderNormToBeatHz(0, tier, 'exponential')).toBeCloseTo(MIN_BEAT_HZ_PREMIUM, 2);
    const eps = sliderNormToBeatHz(beatHzToSliderNorm(0.2, tier, 'exponential'), tier, 'exponential');
    expect(eps).toBeCloseTo(0.2, 1);
    const lambda = sliderNormToBeatHz(beatHzToSliderNorm(120, tier, 'exponential'), tier, 'exponential');
    expect(lambda).toBeCloseTo(120, 0);
    expect(sliderNormToBeatHz(1, tier, 'exponential')).toBeCloseTo(MAX_BEAT_HZ_PREMIUM, 0);
  });
});

describe('beatHzSlider free tier track', () => {
  it('maps 40 Hz below the end of the full premium track', () => {
    const tier = 'free' as const;
    const cap = beatHzFreeCapNorm('exponential');
    expect(cap).toBeGreaterThan(0.2);
    expect(cap).toBeLessThan(0.85);
    expect(beatHzToSliderNorm(40, tier, 'exponential')).toBeCloseTo(cap, 3);
    expect(sliderNormToBeatHz(1, tier, 'exponential')).toBe(MAX_BEAT_HZ);
    expect(sliderNormToBeatHz(cap + 0.1, tier, 'exponential')).toBe(MAX_BEAT_HZ);
  });
});

describe('beatHzSlider linear mapping', () => {
  it('maps endpoints and midpoints linearly', () => {
    const tier = 'premium' as const;
    const min = MIN_BEAT_HZ_PREMIUM;
    const max = MAX_BEAT_HZ_PREMIUM;
    expect(sliderNormToBeatHz(0, tier, 'linear')).toBeCloseTo(min, 2);
    expect(sliderNormToBeatHz(1, tier, 'linear')).toBeCloseTo(max, 0);
    const midHz = min + (max - min) * 0.5;
    expect(sliderNormToBeatHz(0.5, tier, 'linear')).toBeCloseTo(midHz, 0);
    expect(beatHzToSliderNorm(midHz, tier, 'linear')).toBeCloseTo(0.5, 3);
  });
});
