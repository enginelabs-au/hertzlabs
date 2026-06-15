import type {StateCreator} from 'zustand';
import type {AppStore, LayoutModeSlice} from '../types';

export const createLayoutModeSlice: StateCreator<AppStore, [], [], LayoutModeSlice> = set => ({
  isAdvancedMode: true,

  toggleAdvancedMode: () => set(s => ({isAdvancedMode: !s.isAdvancedMode})),
});
