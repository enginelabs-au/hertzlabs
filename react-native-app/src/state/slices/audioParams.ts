import type {StateCreator} from 'zustand';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {breathGainMultiplierAt, modulatedBreathGain} from '../../breathPacer/breathEnvelope';
import {DEFAULT_NOISE_MIX, layersFromLegacyNoiseType} from '../../audio/noiseLayers';
import {pushNoiseToNative} from '../../audio/pushNoiseToNative';
import {
  DEFAULT_RAMP_MS,
  clampGain,
  type BinauralParameters,
  sanitizeBinauralParameters,
} from '../../audio/paramMapping';
import {isExperimentalModeActive} from '../../monetization/isPremiumUnlocked';
import type {AppStore, AudioParamsSlice, AudioParamsValues, NoiseLayers, Preset} from '../types';

const defaultNoiseLayers: NoiseLayers = {
  white: false,
  pink: false,
  brown: false,
};

const defaultAudioParams: AudioParamsValues = {
  carrierHz: 220,
  beatHz: 10,
  gain: 0.45,
  balance: 0,
  waveform: 'sine',
  noiseType: 'none',
  noiseLevel: 0,
  noiseLayers: defaultNoiseLayers,
  noiseMix: DEFAULT_NOISE_MIX,
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

function normalizeNoiseLayers(
  values: Partial<AudioParamsValues>,
): NoiseLayers {
  if (values.noiseLayers != null) {
    return {
      white: Boolean(values.noiseLayers.white),
      pink: Boolean(values.noiseLayers.pink),
      brown: Boolean(values.noiseLayers.brown),
    };
  }
  if (values.noiseType != null && values.noiseType !== 'none') {
    return layersFromLegacyNoiseType(values.noiseType);
  }
  return defaultNoiseLayers;
}

function sanitize(
  values: AudioParamsValues & {leftDriftMs?: number; rightDriftMs?: number},
  tier: AppStore['tier'],
  experimental = false,
): AudioParamsValues {
  const leftDriftHz =
    typeof values.leftDriftHz === 'number' ? values.leftDriftHz : 0;
  const rightDriftHz =
    typeof values.rightDriftHz === 'number' ? values.rightDriftHz : 0;
  const noiseLayers = normalizeNoiseLayers(values);
  const noiseMix = clampGain(
    typeof values.noiseMix === 'number' ? values.noiseMix : DEFAULT_NOISE_MIX,
  );
  return {
    ...sanitizeBinauralParameters(values as BinauralParameters, tier, experimental),
    waveform: values.waveform,
    phaseAngle: clampNumber(values.phaseAngle, 0, 360, 0),
    leftDriftHz: clampDriftHz(leftDriftHz),
    rightDriftHz: clampDriftHz(rightDriftHz),
    noiseLayers,
    noiseMix,
    noiseType: values.noiseType ?? 'none',
    noiseLevel: clampGain(values.noiseLevel ?? 0),
  };
}

export const createAudioParamsSlice: StateCreator<AppStore, [], [], AudioParamsSlice> = (set, get) => ({
  ...defaultAudioParams,

  setParam: (key, value) => {
    if (key === 'gain') {
      const state = get();
      const nextGain = clampGain(value as number);
      if (state.breathPacerEnabled && state.breathClockStartedAtMs != null) {
        const mult = breathGainMultiplierAt(
          state.breathPatternId,
          state.breathDeltaDb,
          state.breathClockStartedAtMs,
        );
        set(s =>
          sanitize(
            {
              ...s,
              breathGainAnchor: nextGain,
              gain: modulatedBreathGain(nextGain, mult),
            } as AudioParamsValues,
            s.tier,
            isExperimentalModeActive(s.tier, s.experimentalMode),
          ),
        );
        return;
      }
    }

    set(state =>
      sanitize(
        {...state, [key]: value} as AudioParamsValues,
        state.tier,
        isExperimentalModeActive(state.tier, state.experimentalMode),
      ),
    );
  },

  toggleNoiseLayer: layer => {
    set(state => {
      const isActive = state.noiseLayers[layer];
      const noiseLayers = isActive
        ? defaultNoiseLayers
        : {white: layer === 'white', pink: layer === 'pink', brown: layer === 'brown'};
      const noiseMix = isActive
        ? state.noiseMix
        : DEFAULT_NOISE_MIX;
      return sanitize(
        {...state, noiseLayers, noiseMix},
        state.tier,
        isExperimentalModeActive(state.tier, state.experimentalMode),
      );
    });
    const s = get();
    pushNoiseToNative(s.noiseLayers, s.noiseMix);
  },

  setNoiseMix: mix => {
    set(state =>
      sanitize(
        {...state, noiseMix: mix},
        state.tier,
        isExperimentalModeActive(state.tier, state.experimentalMode),
      ),
    );
    const s = get();
    pushNoiseToNative(s.noiseLayers, s.noiseMix);
  },

  applyPreset: (preset: Preset) => {
    set(state =>
      sanitize(
        preset.params,
        state.tier,
        isExperimentalModeActive(state.tier, state.experimentalMode),
      ),
    );
  },
});
