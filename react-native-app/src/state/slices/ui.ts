import type {StateCreator} from 'zustand';
import type {AppStore, UiSlice} from '../types';

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = set => ({
  theme: 'system',
  onboardingDone: false,
  hasAcceptedSafetyTerms: false,
  activeModal: null,

  setTheme: theme => set({theme}),
  setOnboardingDone: onboardingDone => set({onboardingDone}),
  setHasAcceptedSafetyTerms: hasAcceptedSafetyTerms => set({hasAcceptedSafetyTerms}),
  setActiveModal: activeModal => set({activeModal}),
});
