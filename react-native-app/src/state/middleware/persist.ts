import type {StateStorage} from 'zustand/middleware';
import {createJSONStorage, persist} from 'zustand/middleware';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {normalizePromoEntitlement, PROMO_CLAIM_RESET_EPOCH} from '../slices/promo';
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
      const resetEpoch = state.promoClaimResetEpoch ?? state.outreachPromoResetEpoch ?? 0;
      if (resetEpoch < PROMO_CLAIM_RESET_EPOCH) {
        state.reviewRewardClaimed = false;
        state.streakReward7Claimed = false;
        state.streakReward30Claimed = false;
        state.streakBonusMilestonesClaimed = [];
        state.anniversaryRewardClaimed = false;
        state.wellnessCheckinCount = 0;
        state.lastWellnessCheckinDate = null;
        state.shareLinkRewardClaimed = false;
        state.postSubmissionPending = false;
        state.postRewardGranted = false;
        state.practitionerSubmissionPending = false;
        state.practitionerRewardGranted = false;
        state.betaRequestPending = false;
        state.betaRewardGranted = false;
        state.appliedPromoCode = null;
        state.appliedPromoEntitlement = null;
        state.appliedPromoExpiresAt = null;
        state.clipboardPromoCode = null;
        state.promoClaimResetEpoch = PROMO_CLAIM_RESET_EPOCH;
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
    photicStrobeEnabled: state.photicStrobeEnabled,
    photicStrobeConsentGiven: state.photicStrobeConsentGiven,
    streakRemindersEnabled: state.streakRemindersEnabled,
    promotionalOffersEnabled: state.promotionalOffersEnabled,
    guidedDepthEnabled: state.guidedDepthEnabled,
    guidedDepthPresetId: state.guidedDepthPresetId,
    asmrEnabled: state.asmrEnabled,
    asmrStemMix: state.asmrStemMix,
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
    forceUpdateDismissedAtLaunch: state.forceUpdateDismissedAtLaunch,
    welcomePremiumDismissedAtLaunch: state.welcomePremiumDismissedAtLaunch,
    paywallNudgeDismissedAtLaunch: state.paywallNudgeDismissedAtLaunch,
    premiumGiftDayBeforeDismissedAtLaunch: state.premiumGiftDayBeforeDismissedAtLaunch,
    premiumGiftExpiryDayDismissedAtLaunch: state.premiumGiftExpiryDayDismissedAtLaunch,
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
    shareLinkRewardClaimed: state.shareLinkRewardClaimed,
    promoClaimResetEpoch: state.promoClaimResetEpoch,
    welcomePremiumClaimedAt: state.welcomePremiumClaimedAt,
    welcomePremiumCampaignId: state.welcomePremiumCampaignId,
    welcomePremiumExpiresAtMs: state.welcomePremiumExpiresAtMs,
    welcomePremiumDayBeforeReminderShown: state.welcomePremiumDayBeforeReminderShown,
    welcomePremiumExpiryDayReminderShown: state.welcomePremiumExpiryDayReminderShown,
    peakStreakDays: state.peakStreakDays,
    streakShieldsUsed: state.streakShieldsUsed,
    lastQualifyingDate: state.lastQualifyingDate,
    todayQualifyingPlaybackSec: state.todayQualifyingPlaybackSec,
    todayQualifyingBucketDate: state.todayQualifyingBucketDate,
    streakBreakEpisodeId: state.streakBreakEpisodeId,
    streakRestoreOfferedAtMs: state.streakRestoreOfferedAtMs,
    streakRestoreDeclinedAtMs: state.streakRestoreDeclinedAtMs,
    lapsed7RestoreAtMs: state.lapsed7RestoreAtMs,
    lapsed30WinbackAtMs: state.lapsed30WinbackAtMs,
    streakRestoreHardDeclined: state.streakRestoreHardDeclined,
    focusChallengeStatus: state.focusChallengeStatus,
    focusChallengeAttemptId: state.focusChallengeAttemptId,
    focusChallengeCurrentDay: state.focusChallengeCurrentDay,
    focusChallengeLastCompletedDate: state.focusChallengeLastCompletedDate,
    focusChallengeStartedAtMs: state.focusChallengeStartedAtMs,
    focusChallengeRewardClaimed: state.focusChallengeRewardClaimed,
  }),
};

export {persist};
