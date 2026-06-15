import type {StateCreator} from 'zustand';
import {clampGain} from '../../audio/paramMapping';
import {breathGainMultiplierAt, modulatedBreathGain} from '../../breathPacer/breathEnvelope';
import type {AppStore, BreathPacerSlice} from '../types';
import {
  DEFAULT_BREATH_DELTA_DB,
  MAX_BREATH_DELTA_DB,
  MIN_BREATH_DELTA_DB,
} from '../../breathPacer/patterns';

export const createBreathPacerSlice: StateCreator<
  AppStore,
  [],
  [],
  BreathPacerSlice
> = (set, get) => ({
  breathPacerEnabled: false,
  breathPatternId: 'box',
  breathDeltaDb: DEFAULT_BREATH_DELTA_DB,
  breathGainAnchor: 0.45,
  breathClockStartedAtMs: null,

  setBreathPacerEnabled: enabled => {
    const state = get();
    if (enabled) {
      const now = Date.now();
      const anchor = state.gain;
      const live =
        state.isPlaying && !state.isPaused
          ? modulatedBreathGain(
              anchor,
              breathGainMultiplierAt(state.breathPatternId, state.breathDeltaDb, now),
            )
          : anchor;
      set({
        breathPacerEnabled: true,
        breathGainAnchor: anchor,
        breathClockStartedAtMs: now,
        gain: live,
      });
      return;
    }
    set({
      breathPacerEnabled: false,
      breathClockStartedAtMs: null,
      gain: state.breathGainAnchor,
    });
  },

  setBreathPatternId: patternId => {
    set({
      breathPatternId: patternId,
      breathClockStartedAtMs: get().breathPacerEnabled ? Date.now() : get().breathClockStartedAtMs,
    });
  },

  setBreathDeltaDb: deltaDb =>
    set({
      breathDeltaDb: Math.max(MIN_BREATH_DELTA_DB, Math.min(MAX_BREATH_DELTA_DB, deltaDb)),
    }),

  setBreathGainAnchor: anchor => {
    const clamped = clampGain(anchor);
    const state = get();
    if (state.breathPacerEnabled && state.breathClockStartedAtMs != null) {
      const mult = breathGainMultiplierAt(
        state.breathPatternId,
        state.breathDeltaDb,
        state.breathClockStartedAtMs,
      );
      set({
        breathGainAnchor: clamped,
        gain: modulatedBreathGain(clamped, mult),
      });
      return;
    }
    set({breathGainAnchor: clamped});
  },
});
