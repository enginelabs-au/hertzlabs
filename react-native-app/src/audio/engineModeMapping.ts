import type {AppStore, EngineMode} from '../state/types';
import {channelFrequencies, nativeBinauralFromChannels} from './channelFrequencies';
import type {BinauralParameters} from './paramMapping';
import {sanitizeBinauralParameters} from './paramMapping';

export type MappedNativeAudio = BinauralParameters & {
  phaseAngle: number;
  timingDiffMs: number;
};

// Native currently receives mode through the existing timingMs bridge slot.
// Keep codes in sync with NativeEngineModeCode in BinauralOscillatorNode.swift.
export const NATIVE_ENGINE_MODE_CODE: Record<EngineMode, number> = {
  binaural: 0,
  monaural: 1,
  isochronic: 2,
  hemisphericSync: 3,
  phaseModulated: 4,
  pitchPanning: 5,
  musicModulation: 6,
};

/**
 * Maps UI store + engine mode to parameters sent to the native oscillator.
 * TARGET beatHz stays in the store; per-ear drift folds into native carrier/beat.
 */
export function mapStateToNativeAudio(state: AppStore): MappedNativeAudio {
  const tier = state.tier;
  const experimental = state.experimentalMode === true;
  const base = sanitizeBinauralParameters(
    {
      carrierHz: state.carrierHz,
      beatHz: state.beatHz,
      gain: state.gain,
      balance: state.balance,
      noiseType: state.noiseType,
      noiseLevel: state.noiseLevel,
      fadeMs: state.fadeMs,
    },
    tier,
    experimental,
  );

  let phaseAngle = state.phaseAngle;
  let beatHz = base.beatHz;
  let gain = base.gain;
  let balance = base.balance;
  let carrierHz = base.carrierHz;
  const timingDiffMs = NATIVE_ENGINE_MODE_CODE[state.engineType] ?? NATIVE_ENGINE_MODE_CODE.binaural;

  switch (state.engineType) {
    case 'monaural':
    case 'isochronic':
      // Native needs the beat to render the interference / pulse envelope.
      balance = 0;
      break;
    case 'hemisphericSync':
      // Same carrier in both ears (no L/R pitch split). The beat is preserved as
      // the rate at which the native inter-aural phase offset sways, so the freq
      // slider drives a perceptible moving phase relationship (not a static tone).
      balance = 0;
      phaseAngle = (state.phaseAngle + 90) % 360;
      break;
    case 'phaseModulated':
      break;
    case 'pitchPanning':
      break;
    case 'musicModulation':
      gain = base.gain * 0.88;
      break;
    case 'binaural':
    default:
      break;
  }

  let nativeCarrierHz = carrierHz;
  let nativeBeatHz = beatHz;

  if (state.engineType === 'binaural') {
    // Binaural is the only mode where per-ear drift should alter the native
    // L/R frequency split. Mono/dynamic modes render their own envelope,
    // phase, or panning from the canonical carrier + target beat.
    const {leftHz, rightHz} = channelFrequencies(
      carrierHz,
      beatHz,
      state.leftDriftHz,
      state.rightDriftHz,
    );
    const native = nativeBinauralFromChannels(leftHz, rightHz);
    nativeCarrierHz = native.carrierHz;
    nativeBeatHz = native.beatHz;
  }

  return {
    ...base,
    carrierHz: nativeCarrierHz,
    beatHz: nativeBeatHz,
    gain,
    balance,
    phaseAngle,
    timingDiffMs,
  };
}
