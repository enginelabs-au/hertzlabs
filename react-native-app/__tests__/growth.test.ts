import {describe, expect, it} from 'vitest';
import {WELCOME_PREMIUM_CAMPAIGN} from '../src/monetization/welcomePremiumConstants';
import {
  shouldOfferReviewPrompt,
  shouldShowForceUpdateOverlay,
  shouldShowPaywallNudge,
  shouldShowWelcomePremiumOffer,
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
        paywallNudgeDismissedAtLaunch: null,
      }),
    ).toBe(false);

    expect(
      shouldShowPaywallNudge({
        tier: 'free',
        appLaunchCount: 2,
        cumulativePlaybackSec: 120,
        paywallSoftPromptShown: false,
        paywallNudgeDismissedAtLaunch: null,
      }),
    ).toBe(true);

    expect(
      shouldShowPaywallNudge({
        tier: 'free',
        appLaunchCount: 5,
        cumulativePlaybackSec: 600,
        paywallSoftPromptShown: true,
        paywallNudgeDismissedAtLaunch: null,
      }),
    ).toBe(false);

    expect(
      shouldShowPaywallNudge({
        tier: 'free',
        appLaunchCount: 5,
        cumulativePlaybackSec: 600,
        paywallSoftPromptShown: false,
        paywallNudgeDismissedAtLaunch: 5,
      }),
    ).toBe(false);
  });

  it('shows force update overlay until dismissed for the session', () => {
    expect(
      shouldShowForceUpdateOverlay({
        forceUpdateRequired: true,
        forceUpdateDismissedAtLaunch: null,
        appLaunchCount: 3,
      }),
    ).toBe(true);

    expect(
      shouldShowForceUpdateOverlay({
        forceUpdateRequired: true,
        forceUpdateDismissedAtLaunch: 3,
        appLaunchCount: 3,
      }),
    ).toBe(false);

    expect(
      shouldShowForceUpdateOverlay({
        forceUpdateRequired: true,
        forceUpdateDismissedAtLaunch: 3,
        appLaunchCount: 4,
      }),
    ).toBe(true);
  });

  it('re-shows welcome premium after a new launch when dismissed', () => {
    expect(
      shouldShowWelcomePremiumOffer({
        welcomePremiumCampaignId: null,
        welcomePremiumDismissedAtLaunch: 2,
        appLaunchCount: 2,
        campaignId: WELCOME_PREMIUM_CAMPAIGN,
      }),
    ).toBe(false);

    expect(
      shouldShowWelcomePremiumOffer({
        welcomePremiumCampaignId: null,
        welcomePremiumDismissedAtLaunch: 2,
        appLaunchCount: 3,
        campaignId: WELCOME_PREMIUM_CAMPAIGN,
      }),
    ).toBe(true);
  });
});
