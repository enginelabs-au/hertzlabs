import type {StateCreator} from 'zustand';
import {clampDriftHz} from '../../audio/channelFrequencies';
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
  leftDriftHz: 0,
  rightDriftHz: 0,
};

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function sanitize(
  values: AudioParamsValues & {leftDriftMs?: number; rightDriftMs?: number},
  tier: AppStore['tier'],
): AudioParamsValues {
  const leftDriftHz =
    typeof values.leftDriftHz === 'number' ? values.leftDriftHz : 0;
  const rightDriftHz =
    typeof values.rightDriftHz === 'number' ? values.rightDriftHz : 0;
  return {
    ...sanitizeBinauralParameters(values as BinauralParameters, tier),
    waveform: values.waveform,
    phaseAngle: clampNumber(values.phaseAngle, 0, 360, 0),
    leftDriftHz: clampDriftHz(leftDriftHz),
    rightDriftHz: clampDriftHz(rightDriftHz),
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
