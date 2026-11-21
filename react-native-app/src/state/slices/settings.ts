import type {StateCreator} from 'zustand';
import type {AppStore, SettingsSlice} from '../types';

/** One-time migration: streak local notifications were on by default; now opt-in only. */
export const STREAK_REMINDERS_OPT_IN_EPOCH = 1;

export const createSettingsSlice: StateCreator<AppStore, [], [], SettingsSlice> = set => ({
  defaultDurationSec: 20 * 60,
  haptics: true,
  keepAwake: true,
  backgroundAudio: false,
  isKineticModeEnabled: false,
  beatSliderScale: 'exponential',
  experimentalMode: false,
  photicStrobeEnabled: false,
  photicStrobeConsentGiven: false,
  streakRemindersEnabled: false,
  streakRemindersOptInEpoch: 0,
  /** One-time offer after the first 2-minute session. */
  streakRemindersPromptShown: false,
  promotionalOffersEnabled: true,
  lastUsedParams: null,

  updateSettings: settings => set(settings),
  setPhoticStrobeEnabled: photicStrobeEnabled => set({photicStrobeEnabled}),
  setPhoticStrobeConsentGiven: photicStrobeConsentGiven => set({photicStrobeConsentGiven}),
});
