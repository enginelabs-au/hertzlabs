import type {StateCreator} from 'zustand';
import type {AppStore, SettingsSlice} from '../types';

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
  lastUsedParams: null,

  updateSettings: settings => set(settings),
  setPhoticStrobeEnabled: photicStrobeEnabled => set({photicStrobeEnabled}),
  setPhoticStrobeConsentGiven: photicStrobeConsentGiven => set({photicStrobeConsentGiven}),
});
