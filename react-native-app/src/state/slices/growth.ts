import type {StateCreator} from 'zustand';
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
  /** One-time post-value paywall nudge for free users. */
  paywallSoftPromptShown: boolean;
  /** Blocking update screen — set each launch from remote policy. */
  forceUpdateRequired: boolean;
  recordAppLaunch(): void;
  addPlaybackSeconds(seconds: number): void;
  markReviewPromptShown(version: string): void;
  markPaywallSoftPromptShown(): void;
  setForceUpdateRequired(required: boolean): void;
};

export const createGrowthSlice: StateCreator<AppStore, [], [], GrowthSlice> = set => ({
  appLaunchCount: 0,
  cumulativePlaybackSec: 0,
  reviewPromptedForVersion: null,
  paywallSoftPromptShown: false,
  forceUpdateRequired: false,

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
});

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
}): boolean {
  return (
    input.tier === 'free' &&
    !input.paywallSoftPromptShown &&
    input.appLaunchCount >= GROWTH_PAYWALL_NUDGE_MIN_LAUNCHES &&
    input.cumulativePlaybackSec >= GROWTH_PAYWALL_NUDGE_MIN_PLAYBACK_SEC
  );
}
