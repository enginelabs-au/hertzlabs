import type {StateCreator} from 'zustand';
import type {AISlice, AppStore} from '../types';

export const createAISlice: StateCreator<AppStore, [], [], AISlice> = set => ({
  status: 'idle',
  prompt: '',
  plan: null,
  suggestions: [],
  error: null,

  setPrompt: prompt => set({prompt}),
  resetAI: () => set({status: 'idle', prompt: '', plan: null, suggestions: [], error: null}),
});
