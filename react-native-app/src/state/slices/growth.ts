import type {StateCreator} from 'zustand';
import type {PremiumGiftReminderKind} from '../../monetization/premiumGiftReminders';
import type {AppStore} from '../types';

export const GROWTH_REVIEW_MIN_PLAYBACK_SEC = 180;
export const GROWTH_REVIEW_MIN_LAUNCHES = 2;
export const GROWTH_PAYWALL_NUDGE_MIN_PLAYBACK_SEC = 120;
export const GROWTH_PAYWALL_NUDGE_MIN_LAUNCHES = 2;

export type GrowthSlice = {
  /** Cold starts after safety onboarding (persisted). */
  appLaunchCount: number;
  /** Total seconds of active playback across sessions (persisted). */
  cumulativePlaybackSec: number;
  /** App version string we last showed the native review prompt for. */
  reviewPromptedForVersion: string | null;
  /** Set when user subscribes — stops the post-value paywall nudge permanently. */
  paywallSoftPromptShown: boolean;
  /** Remote policy says a store update is required (checked each launch). */
  forceUpdateRequired: boolean;
  /** Launch count when user dismissed the update overlay for the current session. */
  forceUpdateDismissedAtLaunch: number | null;
  welcomePremiumDismissedAtLaunch: number | null;
  paywallNudgeDismissedAtLaunch: number | null;
  premiumGiftDayBeforeDismissedAtLaunch: number | null;
  premiumGiftExpiryDayDismissedAtLaunch: number | null;
  recordAppLaunch(): void;
  addPlaybackSeconds(seconds: number): void;
  markReviewPromptShown(version: string): void;
  markPaywallSoftPromptShown(): void;
  setForceUpdateRequired(required: boolean): void;
  dismissForceUpdateForSession(): void;
  dismissWelcomePremiumForSession(): void;
  dismissPaywallNudgeForSession(): void;
  dismissPremiumGiftReminderForSession(kind: PremiumGiftReminderKind): void;
};

export const createGrowthSlice: StateCreator<AppStore, [], [], GrowthSlice> = set => ({
  appLaunchCount: 0,
  cumulativePlaybackSec: 0,
  reviewPromptedForVersion: null,
  paywallSoftPromptShown: false,
  forceUpdateRequired: false,
  forceUpdateDismissedAtLaunch: null,
  welcomePremiumDismissedAtLaunch: null,
  paywallNudgeDismissedAtLaunch: null,
  premiumGiftDayBeforeDismissedAtLaunch: null,
  premiumGiftExpiryDayDismissedAtLaunch: null,

  recordAppLaunch() {
    set(s => ({appLaunchCount: s.appLaunchCount + 1}));
  },

  addPlaybackSeconds(seconds) {
    if (seconds <= 0) {
      return;
    }
    set(s => ({cumulativePlaybackSec: s.cumulativePlaybackSec + seconds}));
  },

  markReviewPromptShown(version) {
    set({reviewPromptedForVersion: version});
  },

  markPaywallSoftPromptShown() {
    set({paywallSoftPromptShown: true});
  },

  setForceUpdateRequired(required) {
    set({forceUpdateRequired: required});
  },

  dismissForceUpdateForSession() {
    set(s => ({forceUpdateDismissedAtLaunch: s.appLaunchCount}));
  },

  dismissWelcomePremiumForSession() {
    set(s => ({welcomePremiumDismissedAtLaunch: s.appLaunchCount}));
  },

  dismissPaywallNudgeForSession() {
    set(s => ({paywallNudgeDismissedAtLaunch: s.appLaunchCount}));
  },

  dismissPremiumGiftReminderForSession(kind) {
    set(s =>
      kind === 'dayBefore'
        ? {premiumGiftDayBeforeDismissedAtLaunch: s.appLaunchCount}
        : {premiumGiftExpiryDayDismissedAtLaunch: s.appLaunchCount},
    );
  },
});

/** True when the user closed a growth prompt during this cold start. */
export function wasGrowthPromptDismissedThisLaunch(
  dismissedAtLaunch: number | null,
  appLaunchCount: number,
): boolean {
  return dismissedAtLaunch === appLaunchCount;
}

export function shouldShowForceUpdateOverlay(input: {
  forceUpdateRequired: boolean;
  forceUpdateDismissedAtLaunch: number | null;
  appLaunchCount: number;
}): boolean {
  return (
    input.forceUpdateRequired &&
    !wasGrowthPromptDismissedThisLaunch(
      input.forceUpdateDismissedAtLaunch,
      input.appLaunchCount,
    )
  );
}

export function shouldShowWelcomePremiumOffer(input: {
  welcomePremiumCampaignId: string | null;
  welcomePremiumDismissedAtLaunch: number | null;
  appLaunchCount: number;
  campaignId: string;
}): boolean {
  return (
    input.welcomePremiumCampaignId !== input.campaignId &&
    !wasGrowthPromptDismissedThisLaunch(
      input.welcomePremiumDismissedAtLaunch,
      input.appLaunchCount,
    )
  );
}

export function shouldShowPremiumGiftReminder(input: {
  kind: PremiumGiftReminderKind;
  premiumGiftDayBeforeDismissedAtLaunch: number | null;
  premiumGiftExpiryDayDismissedAtLaunch: number | null;
  appLaunchCount: number;
}): boolean {
  const dismissedAt =
    input.kind === 'dayBefore'
      ? input.premiumGiftDayBeforeDismissedAtLaunch
      : input.premiumGiftExpiryDayDismissedAtLaunch;
  return !wasGrowthPromptDismissedThisLaunch(dismissedAt, input.appLaunchCount);
}

export function shouldOfferReviewPrompt(input: {
  appLaunchCount: number;
  cumulativePlaybackSec: number;
  reviewPromptedForVersion: string | null;
  appVersion: string;
}): boolean {
  return (
    input.appLaunchCount >= GROWTH_REVIEW_MIN_LAUNCHES &&
    input.cumulativePlaybackSec >= GROWTH_REVIEW_MIN_PLAYBACK_SEC &&
    input.reviewPromptedForVersion !== input.appVersion
  );
}

export function shouldShowPaywallNudge(input: {
  tier: 'free' | 'premium';
  appLaunchCount: number;
  cumulativePlaybackSec: number;
  paywallSoftPromptShown: boolean;
  paywallNudgeDismissedAtLaunch: number | null;
}): boolean {
  return (
    input.tier === 'free' &&
    !input.paywallSoftPromptShown &&
    input.appLaunchCount >= GROWTH_PAYWALL_NUDGE_MIN_LAUNCHES &&
    input.cumulativePlaybackSec >= GROWTH_PAYWALL_NUDGE_MIN_PLAYBACK_SEC &&
    !wasGrowthPromptDismissedThisLaunch(
      input.paywallNudgeDismissedAtLaunch,
      input.appLaunchCount,
    )
  );
}
