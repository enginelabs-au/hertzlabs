import type {StateCreator} from 'zustand';
import type {AppStore, SettingsSlice} from '../types';

export const createSettingsSlice: StateCreator<AppStore, [], [], SettingsSlice> = set => ({
  defaultDurationSec: 20 * 60,
  haptics: true,
  keepAwake: true,
  backgroundAudio: false,
  isKineticModeEnabled: false,
  lastUsedParams: null,

  updateSettings: settings => set(settings),
});
