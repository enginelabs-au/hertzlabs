import type {StateCreator} from 'zustand';
import {
  DEFAULT_RAMP_MS,
  type BinauralParameters,
  sanitizeBinauralParameters,
} from '../../audio/paramMapping';
import type {AppStore, AudioParamsSlice, AudioParamsValues, Preset} from '../types';

const defaultAudioParams: AudioParamsValues = {
  carrierHz: 220,
  beatHz: 10,
  gain: 0.45,
  balance: 0,
  waveform: 'sine',
  noiseType: 'none',
  noiseLevel: 0,
  fadeMs: DEFAULT_RAMP_MS,
  phaseAngle: 0,
  timingDiffMs: 0,
};

function sanitize(values: AudioParamsValues, tier: AppStore['tier']): AudioParamsValues {
  return {
    ...sanitizeBinauralParameters(values as BinauralParameters, tier),
    waveform: values.waveform,
    phaseAngle: values.phaseAngle,
    timingDiffMs: values.timingDiffMs,
  };
}

export const createAudioParamsSlice: StateCreator<AppStore, [], [], AudioParamsSlice> = set => ({
  ...defaultAudioParams,

  setParam: (key, value) => {
    set(state => sanitize({...state, [key]: value} as AudioParamsValues, state.tier));
  },

  applyPreset: (preset: Preset) => {
    set(state => sanitize(preset.params, state.tier));
  },
});
