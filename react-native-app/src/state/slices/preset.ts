import type {StateCreator} from 'zustand';
import type {AppStore, Preset, PresetSlice} from '../types';

const builtin: Preset[] = [
  {
    id: 'schumann-primary',
    name: 'Schumann Primary',
    params: {
      carrierHz: 220,
      beatHz: 7.83,
      gain: 0.2,
      balance: 0,
      waveform: 'sine',
      noiseType: 'none',
      noiseLevel: 0,
      noiseLayers: {white: false, pink: false, brown: false},
      noiseMix: 0.38,
      fadeMs: 75,
      phaseAngle: 0,
      leftDriftHz: 0,
      rightDriftHz: 0,
    },
  },
  {
    id: 'alpha-focus',
    name: 'Alpha Focus',
    params: {
      carrierHz: 220,
      beatHz: 10,
      gain: 0.2,
      balance: 0,
      waveform: 'sine',
      noiseType: 'none',
      noiseLevel: 0,
      noiseLayers: {white: false, pink: false, brown: false},
      noiseMix: 0.38,
      fadeMs: 75,
      phaseAngle: 0,
      leftDriftHz: 0,
      rightDriftHz: 0,
    },
  },
];

export const createPresetSlice: StateCreator<AppStore, [], [], PresetSlice> = set => ({
  builtin,
  custom: [],

  addCustomPreset: preset => {
    set(state => ({
      custom: [...state.custom.filter(existing => existing.id !== preset.id), preset],
    }));
  },

  removeCustomPreset: id => {
    set(state => ({
      custom: state.custom.filter(preset => preset.id !== id),
    }));
  },
});
