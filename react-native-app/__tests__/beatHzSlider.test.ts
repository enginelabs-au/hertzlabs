import {describe, expect, it, vi} from 'vitest';

vi.mock('../src/monetization/isPremiumUnlocked', () => ({
  FORCED_V1_TEST_UNLOCK: false,
  isPremiumUnlocked: (tier: string) => tier === 'premium',
}));

import {beatHzToSliderNorm, sliderNormToBeatHz} from '../src/audio/beatHzSlider';
import {MAX_BEAT_HZ_PREMIUM, MIN_BEAT_HZ_PREMIUM} from '../src/audio/paramMapping';

describe('beatHzSlider log mapping', () => {
  it('maps epsilon and lambda within premium range', () => {
    const tier = 'premium' as const;
    expect(sliderNormToBeatHz(0, tier)).toBeCloseTo(MIN_BEAT_HZ_PREMIUM, 2);
    const eps = sliderNormToBeatHz(beatHzToSliderNorm(0.2, tier), tier);
    expect(eps).toBeCloseTo(0.2, 1);
    const lambda = sliderNormToBeatHz(beatHzToSliderNorm(120, tier), tier);
    expect(lambda).toBeCloseTo(120, 0);
    expect(sliderNormToBeatHz(1, tier)).toBeCloseTo(MAX_BEAT_HZ_PREMIUM, 0);
  });
});
