import {MMKV} from 'react-native-mmkv';
import type {StateStorage} from 'zustand/middleware';
import {createJSONStorage, persist} from 'zustand/middleware';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {normalizePromoEntitlement} from '../slices/promo';
import type {AppStore} from '../types';

// react-native-mmkv v3 uses NitroModules (JSI).  The factory call is lazy
// but still happens at module-evaluation time; guard it so a bridge hiccup
// on a cold-start never crashes the entire JS module graph.
const memMap = new Map<string, string>();
const memFallback: StateStorage = {
  getItem: name => memMap.get(name) ?? null,
  setItem: (name, value) => memMap.set(name, value),
  removeItem: name => memMap.delete(name),
};

let zustandStorage: StateStorage;
try {
  const storage = new MMKV({id: 'hertz-zustand'});
  zustandStorage = {
    getItem: name => {
      try {
        const raw = storage.getString(name);
        if (raw == null) {
          return null;
        }
        JSON.parse(raw);
        return raw;
      } catch (e) {
        console.warn('[persist] corrupt MMKV entry, clearing:', name, e);
        try {
          storage.delete(name);
        } catch {
          /* ignore */
        }
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        storage.set(name, value);
      } catch (e) {
        console.warn('[persist] MMKV setItem failed:', name, e);
      }
    },
    removeItem: name => {
      try {
        storage.delete(name);
      } catch (e) {
        console.warn('[persist] MMKV removeItem failed:', name, e);
      }
    },
  };
} catch (e) {
  console.warn('[persist] MMKV init failed, using in-memory fallback:', e);
  zustandStorage = memFallback;
}

export const persistedStoreOptions = {
  name: 'hertz-store-v1',
  storage: createJSONStorage(() => zustandStorage),
  onRehydrateStorage: () => (state: AppStore | undefined, error: unknown) => {
    if (error != null) {
      console.warn('[persist] rehydrate failed, clearing persisted snapshot:', error);
      try {
        zustandStorage.removeItem('hertz-store-v1');
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
    anniversaryRewardClaimed: state.anniversaryRewardClaimed,
    wellnessCheckinCount: state.wellnessCheckinCount,
    lastWellnessCheckinDate: state.lastWellnessCheckinDate,
    welcomePremiumClaimedAt: state.welcomePremiumClaimedAt,
    welcomePremiumCampaignId: state.welcomePremiumCampaignId,
    welcomePremiumExpiresAtMs: state.welcomePremiumExpiresAtMs,
    welcomePremiumDayBeforeReminderShown: state.welcomePremiumDayBeforeReminderShown,
    welcomePremiumExpiryDayReminderShown: state.welcomePremiumExpiryDayReminderShown,
  }),
};

export {persist};
