import type {StateCreator} from 'zustand';
import {isEngineModeSelectable, resolveEngineMode} from '../../audio/engineModes';
import type {AppStore, EngineSlice, EngineMode} from '../types';

export const createEngineSlice: StateCreator<AppStore, [], [], EngineSlice> = (set, get) => ({
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

  setEngineType: (engineType: EngineMode) => {
    const tier = get().tier;
    if (!isEngineModeSelectable(engineType, tier)) {
      return;
    }
    set({engineType: resolveEngineMode(engineType, tier)});
  },

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
