import {useEffect, useRef} from 'react';
import {useHertzStore} from '../state/store';
import {APP_VERSION} from '../constants/appInfo';
import {WELCOME_PREMIUM_CAMPAIGN} from '../monetization/welcomePremiumConstants';
import {confirmThenRequestAppReview} from '../monetization/requestAppReview';
import {resolvePremiumGiftReminder} from '../monetization/premiumGiftReminders';
import {checkAppUpdateRequired} from '../services/appUpdateService';
import {
  shouldOfferReviewPrompt,
  shouldShowForceUpdateOverlay,
  shouldShowPaywallNudge,
  shouldShowPremiumGiftReminder,
  shouldShowWelcomePremiumOffer,
} from '../state/slices/growth';

const PLAYBACK_TICK_MS = 1000;

/**
 * Tracks launches + playback time, checks mandatory updates, then triggers growth prompts:
 * - dismissible update overlay when remote policy requires it (re-shown each launch until updated)
 * - welcome Premium gift activation
 * - Premium gift expiry reminders (1 day before + on expiry day)
 * - paywall nudge after demonstrated value (free tier, until subscribe)
 * - review prompt after 3+ min cumulative playback (once per version)
 */
export function useGrowthEngagement(hydrated: boolean, promptsEnabled: boolean): void {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const tier = useHertzStore(s => s.tier);
  const activeModal = useHertzStore(s => s.activeModal);
  const forceUpdateRequired = useHertzStore(s => s.forceUpdateRequired);
  const forceUpdateDismissedAtLaunch = useHertzStore(s => s.forceUpdateDismissedAtLaunch);
  const appLaunchCount = useHertzStore(s => s.appLaunchCount);
  const cumulativePlaybackSec = useHertzStore(s => s.cumulativePlaybackSec);
  const reviewPromptedForVersion = useHertzStore(s => s.reviewPromptedForVersion);
  const paywallSoftPromptShown = useHertzStore(s => s.paywallSoftPromptShown);
  const premiumExpiresAtMs = useHertzStore(s => s.premiumExpiresAtMs);
  const premiumIsPromotionalGift = useHertzStore(s => s.premiumIsPromotionalGift);
  const welcomePremiumClaimedAt = useHertzStore(s => s.welcomePremiumClaimedAt);
  const welcomePremiumExpiresAtMs = useHertzStore(s => s.welcomePremiumExpiresAtMs);
  const welcomePremiumDayBeforeReminderShown = useHertzStore(
    s => s.welcomePremiumDayBeforeReminderShown,
  );
  const welcomePremiumExpiryDayReminderShown = useHertzStore(
    s => s.welcomePremiumExpiryDayReminderShown,
  );

  const recordAppLaunch = useHertzStore(s => s.recordAppLaunch);
  const addPlaybackSeconds = useHertzStore(s => s.addPlaybackSeconds);
  const markReviewPromptShown = useHertzStore(s => s.markReviewPromptShown);
  const setForceUpdateRequired = useHertzStore(s => s.setForceUpdateRequired);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const setActivePremiumGiftReminder = useHertzStore(s => s.setActivePremiumGiftReminder);

  const checkInStreak = useHertzStore(s => s.checkInStreak);
  const ensureFirstInstallDate = useHertzStore(s => s.ensureFirstInstallDate);

  const launchRecorded = useRef(false);
  const reviewScheduled = useRef(false);
  const paywallScheduled = useRef(false);
  const welcomeScheduled = useRef(false);
  const premiumGiftScheduled = useRef(false);
  const updateCheckStarted = useRef(false);

  const showForceUpdateOverlay = shouldShowForceUpdateOverlay({
    forceUpdateRequired,
    forceUpdateDismissedAtLaunch,
    appLaunchCount,
  });

  useEffect(() => {
    if (!hydrated || updateCheckStarted.current) {
      return;
    }
    updateCheckStarted.current = true;
    void checkAppUpdateRequired().then(result => {
      setForceUpdateRequired(result.forceUpdate);
    });
  }, [hydrated, setForceUpdateRequired]);

  useEffect(() => {
    if (!promptsEnabled || launchRecorded.current) {
      return;
    }
    launchRecorded.current = true;
    recordAppLaunch();
    checkInStreak();
    ensureFirstInstallDate();
  }, [promptsEnabled, recordAppLaunch, checkInStreak, ensureFirstInstallDate]);

  useEffect(() => {
    if (!promptsEnabled || !isPlaying) {
      return;
    }
    const id = setInterval(() => {
      addPlaybackSeconds(PLAYBACK_TICK_MS / 1000);
    }, PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [promptsEnabled, isPlaying, addPlaybackSeconds]);

  useEffect(() => {
    if (!promptsEnabled || showForceUpdateOverlay || activeModal != null) {
      return;
    }

    const state = useHertzStore.getState();

    if (
      !welcomeScheduled.current &&
      shouldShowWelcomePremiumOffer({
        welcomePremiumCampaignId: state.welcomePremiumCampaignId,
        welcomePremiumDismissedAtLaunch: state.welcomePremiumDismissedAtLaunch,
        appLaunchCount: state.appLaunchCount,
        campaignId: WELCOME_PREMIUM_CAMPAIGN,
      })
    ) {
      welcomeScheduled.current = true;
      setTimeout(() => setActiveModal('welcomePremium'), 600);
      return;
    }

    const giftReminder = resolvePremiumGiftReminder({
      welcomePremiumClaimedAt: state.welcomePremiumClaimedAt,
      welcomePremiumExpiresAtMs: state.welcomePremiumExpiresAtMs,
      premiumExpiresAtMs: state.premiumExpiresAtMs,
      premiumIsPromotionalGift: state.premiumIsPromotionalGift,
      tier: state.tier,
      dayBeforeShown: state.welcomePremiumDayBeforeReminderShown,
      expiryDayShown: state.welcomePremiumExpiryDayReminderShown,
    });

    if (
      !premiumGiftScheduled.current &&
      giftReminder != null &&
      shouldShowPremiumGiftReminder({
        kind: giftReminder,
        premiumGiftDayBeforeDismissedAtLaunch: state.premiumGiftDayBeforeDismissedAtLaunch,
        premiumGiftExpiryDayDismissedAtLaunch: state.premiumGiftExpiryDayDismissedAtLaunch,
        appLaunchCount: state.appLaunchCount,
      })
    ) {
      premiumGiftScheduled.current = true;
      setActivePremiumGiftReminder(giftReminder);
      setActiveModal('premiumGiftExpiry');
      return;
    }

    if (
      !paywallScheduled.current &&
      shouldShowPaywallNudge({
        tier: state.tier,
        appLaunchCount: state.appLaunchCount,
        cumulativePlaybackSec: state.cumulativePlaybackSec,
        paywallSoftPromptShown: state.paywallSoftPromptShown,
        paywallNudgeDismissedAtLaunch: state.paywallNudgeDismissedAtLaunch,
      })
    ) {
      paywallScheduled.current = true;
      setActiveModal('paywall');
      return;
    }

    if (
      !reviewScheduled.current &&
      shouldOfferReviewPrompt({
        appLaunchCount: state.appLaunchCount,
        cumulativePlaybackSec: state.cumulativePlaybackSec,
        reviewPromptedForVersion: state.reviewPromptedForVersion,
        appVersion: APP_VERSION,
      })
    ) {
      reviewScheduled.current = true;
      markReviewPromptShown(APP_VERSION);
      confirmThenRequestAppReview();
    }
  }, [
    promptsEnabled,
    showForceUpdateOverlay,
    activeModal,
    tier,
    appLaunchCount,
    cumulativePlaybackSec,
    reviewPromptedForVersion,
    paywallSoftPromptShown,
    premiumExpiresAtMs,
    premiumIsPromotionalGift,
    welcomePremiumClaimedAt,
    welcomePremiumExpiresAtMs,
    welcomePremiumDayBeforeReminderShown,
    welcomePremiumExpiryDayReminderShown,
    markReviewPromptShown,
    setActiveModal,
    setActivePremiumGiftReminder,
  ]);
}
