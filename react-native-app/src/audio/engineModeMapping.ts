import type {AppStore, EngineMode} from '../state/types';
import {
  channelFrequencies,
  nativeBinauralFromChannels,
} from './channelFrequencies';
import type {BinauralParameters} from './paramMapping';
import {sanitizeBinauralParameters} from './paramMapping';

export type MappedNativeAudio = BinauralParameters & {
  phaseAngle: number;
  timingDiffMs: number;
};

/**
 * Maps UI store + engine mode to parameters sent to the native oscillator.
 * TARGET beatHz stays in the store; per-ear drift folds into native carrier/beat.
 */
export function mapStateToNativeAudio(state: AppStore): MappedNativeAudio {
  const tier = state.tier;
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
  );

  let phaseAngle = state.phaseAngle;
  let beatHz = base.beatHz;
  let gain = base.gain;
  let balance = base.balance;
  let carrierHz = base.carrierHz;

  switch (state.engineType) {
    case 'monaural':
    case 'isochronic':
      beatHz = 0;
      balance = 0;
      break;
    case 'hemisphericSync':
      beatHz = 0;
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

  const {leftHz, rightHz} = channelFrequencies(
    carrierHz,
    beatHz,
    state.leftDriftHz,
    state.rightDriftHz,
  );
  const native = nativeBinauralFromChannels(leftHz, rightHz);

  return {
    ...base,
    carrierHz: native.carrierHz,
    beatHz: native.beatHz,
    gain,
    balance,
    phaseAngle,
    timingDiffMs: 0,
  };
}

export function engineModeUsesModulation(mode: EngineMode): boolean {
  return (
    mode === 'monaural' ||
    mode === 'isochronic' ||
    mode === 'phaseModulated' ||
    mode === 'pitchPanning'
  );
}
