import type {AppStore, EngineMode} from '../state/types';
import type {BinauralParameters} from './paramMapping';
import {sanitizeBinauralParameters} from './paramMapping';

export type MappedNativeAudio = BinauralParameters & {
  phaseAngle: number;
  timingDiffMs: number;
};

/**
 * Maps UI store + engine mode to parameters sent to the native oscillator.
 * Modes that need AM/pan/phase animation still set base values here;
 * `useEngineModeModulation` applies time-varying overrides while playing.
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

  switch (state.engineType) {
    case 'monaural':
    case 'isochronic':
      // Same carrier in both ears; envelope or pan applied in modulation hook.
      beatHz = 0;
      balance = 0;
      break;
    case 'hemisphericSync':
      beatHz = 0;
      balance = 0;
      phaseAngle = (state.phaseAngle + 90) % 360;
      break;
    case 'phaseModulated':
      // Base binaural; phase swept in modulation hook.
      break;
    case 'pitchPanning':
      // Base binaural; balance swept in modulation hook.
      break;
    case 'musicModulation':
      gain = base.gain * 0.88;
      break;
    case 'binaural':
    default:
      break;
  }

  return {
    ...base,
    beatHz,
    gain,
    balance,
    phaseAngle,
    timingDiffMs: state.timingDiffMs,
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
