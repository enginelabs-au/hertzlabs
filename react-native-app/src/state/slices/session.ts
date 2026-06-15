import type {StateCreator} from 'zustand';
import type {AppStore, SessionSlice} from '../types';

export const createSessionSlice: StateCreator<AppStore, [], [], SessionSlice> = set => ({
  sessionId: null,
  presetId: null,
  isPlaying: false,
  isPaused: false,
  durationSec: 20 * 60,
  elapsedSec: 0,
  elapsedClockEpoch: 0,

  requestPlay: () => set({isPlaying: true, isPaused: false}),
  requestPause: () => set({isPlaying: false, isPaused: true}),
  requestStop: () => set({isPlaying: false, isPaused: false, elapsedSec: 0}),
  setElapsedSec: elapsedSec => set({elapsedSec: Math.max(0, elapsedSec)}),
  seekElapsedSec: elapsedSec =>
    set(s => ({
      elapsedSec: Math.max(0, elapsedSec),
      elapsedClockEpoch: s.elapsedClockEpoch + 1,
    })),
});
