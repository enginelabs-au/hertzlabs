import type {StateStorage} from 'zustand/middleware';
import {createJSONStorage, persist} from 'zustand/middleware';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {normalizePromoEntitlement, OUTREACH_PROMO_RESET_EPOCH} from '../slices/promo';
import type {AppStore} from '../types';
import {STORE_KEY, zustandStorage} from './persistStorage';

export const persistedStoreOptions = {
  name: STORE_KEY,
  storage: createJSONStorage(() => zustandStorage),
  onRehydrateStorage: () => (state: AppStore | undefined, error: unknown) => {
    if (error != null) {
      console.warn('[persist] rehydrate failed, clearing persisted snapshot:', error);
      try {
        zustandStorage.removeItem(STORE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (state != null) {
      state.leftDriftHz = clampDriftHz(state.leftDriftHz);
      state.rightDriftHz = clampDriftHz(state.rightDriftHz);
      if (state.breathGainAnchor == null || Number.isNaN(state.breathGainAnchor)) {
        state.breathGainAnchor = state.gain;
      }
      state.breathClockStartedAtMs = state.breathPacerEnabled ? Date.now() : null;
      state.appliedPromoEntitlement = normalizePromoEntitlement(state.appliedPromoEntitlement);
      if ((state.outreachPromoResetEpoch ?? 0) < OUTREACH_PROMO_RESET_EPOCH) {
        state.postSubmissionPending = false;
        state.postRewardGranted = false;
        state.practitionerSubmissionPending = false;
        state.practitionerRewardGranted = false;
        state.betaRequestPending = false;
        state.betaRewardGranted = false;
        state.outreachPromoResetEpoch = OUTREACH_PROMO_RESET_EPOCH;
      }
    }
  },
  partialize: (state: AppStore) => ({
    theme: state.theme,
    onboardingDone: state.onboardingDone,
    hasAcceptedSafetyTerms: state.hasAcceptedSafetyTerms,
    defaultDurationSec: state.defaultDurationSec,
    haptics: state.haptics,
    keepAwake: state.keepAwake,
    backgroundAudio: state.backgroundAudio,
    isKineticModeEnabled: state.isKineticModeEnabled,
    beatSliderScale: state.beatSliderScale,
    experimentalMode: state.experimentalMode,
    lastUsedParams: state.lastUsedParams,
    custom: state.custom,
    tier: state.tier,
    entitlements: state.entitlements,
    engineType: state.engineType,
    isAdvancedMode: state.isAdvancedMode,
    breathPacerEnabled: state.breathPacerEnabled,
    breathPatternId: state.breathPatternId,
    breathDeltaDb: state.breathDeltaDb,
    breathGainAnchor: state.breathGainAnchor,
    appLaunchCount: state.appLaunchCount,
    cumulativePlaybackSec: state.cumulativePlaybackSec,
    reviewPromptedForVersion: state.reviewPromptedForVersion,
    paywallSoftPromptShown: state.paywallSoftPromptShown,
    // promo slice
    appliedPromoCode: state.appliedPromoCode,
    clipboardPromoCode: state.clipboardPromoCode,
    appliedPromoEntitlement: state.appliedPromoEntitlement,
    appliedPromoExpiresAt: state.appliedPromoExpiresAt,
    myReferralCode: state.myReferralCode,
    pendingReferrerCode: state.pendingReferrerCode,
    streakDays: state.streakDays,
    lastStreakDate: state.lastStreakDate,
    firstInstallDate: state.firstInstallDate,
    reviewRewardClaimed: state.reviewRewardClaimed,
    streakReward7Claimed: state.streakReward7Claimed,
    streakReward30Claimed: state.streakReward30Claimed,
    streakBonusMilestonesClaimed: state.streakBonusMilestonesClaimed,
    anniversaryRewardClaimed: state.anniversaryRewardClaimed,
    wellnessCheckinCount: state.wellnessCheckinCount,
    lastWellnessCheckinDate: state.lastWellnessCheckinDate,
    postSubmissionPending: state.postSubmissionPending,
    postRewardGranted: state.postRewardGranted,
    practitionerSubmissionPending: state.practitionerSubmissionPending,
    practitionerRewardGranted: state.practitionerRewardGranted,
    betaRequestPending: state.betaRequestPending,
    betaRewardGranted: state.betaRewardGranted,
    outreachPromoResetEpoch: state.outreachPromoResetEpoch,
    welcomePremiumClaimedAt: state.welcomePremiumClaimedAt,
    welcomePremiumCampaignId: state.welcomePremiumCampaignId,
    welcomePremiumExpiresAtMs: state.welcomePremiumExpiresAtMs,
    welcomePremiumDayBeforeReminderShown: state.welcomePremiumDayBeforeReminderShown,
    welcomePremiumExpiryDayReminderShown: state.welcomePremiumExpiryDayReminderShown,
  }),
};

export {persist};
