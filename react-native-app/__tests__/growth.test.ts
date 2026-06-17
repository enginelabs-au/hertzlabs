import {describe, expect, it} from 'vitest';
import {
  shouldOfferReviewPrompt,
  shouldShowPaywallNudge,
} from '../src/state/slices/growth';

describe('growth engagement gates', () => {
  it('offers review after playback + launch thresholds', () => {
    expect(
      shouldOfferReviewPrompt({
        appLaunchCount: 1,
        cumulativePlaybackSec: 200,
        reviewPromptedForVersion: null,
        appVersion: '2.0',
      }),
    ).toBe(false);

    expect(
      shouldOfferReviewPrompt({
        appLaunchCount: 2,
        cumulativePlaybackSec: 180,
        reviewPromptedForVersion: null,
        appVersion: '2.0',
      }),
    ).toBe(true);

    expect(
      shouldOfferReviewPrompt({
        appLaunchCount: 3,
        cumulativePlaybackSec: 500,
        reviewPromptedForVersion: '2.0',
        appVersion: '2.0',
      }),
    ).toBe(false);
  });

  it('nudges paywall once for engaged free users', () => {
    expect(
      shouldShowPaywallNudge({
        tier: 'premium',
        appLaunchCount: 3,
        cumulativePlaybackSec: 200,
        paywallSoftPromptShown: false,
      }),
    ).toBe(false);

    expect(
      shouldShowPaywallNudge({
        tier: 'free',
        appLaunchCount: 2,
        cumulativePlaybackSec: 120,
        paywallSoftPromptShown: false,
      }),
    ).toBe(true);

    expect(
      shouldShowPaywallNudge({
        tier: 'free',
        appLaunchCount: 5,
        cumulativePlaybackSec: 600,
        paywallSoftPromptShown: true,
      }),
    ).toBe(false);
  });
});
