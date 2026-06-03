import type {StateCreator} from 'zustand';
import type {AppStore, EngineSlice} from '../types';

export const createEngineSlice: StateCreator<AppStore, [], [], EngineSlice> = set => ({
  state: 'uninitialized',
  engineType: 'binaural',
  sampleRate: 48000,
  bufferDurationMs: 5,
  outputRoute: 'unknown',
  measuredLatencyMs: 0,
  lastError: null,
  highVolumeWarningTriggered: false,
  isStereoRoute: true,
  lastSafetyEvent: null,

  setEngineType: engineType => set({engineType}),

  _ingestNativeState: payload => {
    set(state => ({
      ...payload,
      state: payload.state ?? state.state,
      outputRoute: payload.outputRoute ?? state.outputRoute,
      lastError: payload.lastError ?? state.lastError,
    }));
  },

  _ingestNativeError: error => {
    set({state: 'error', lastError: error});
  },
});
