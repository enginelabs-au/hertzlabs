import {useEffect, useRef} from 'react';
import {HertzAudioClient} from '../audio/HertzAudioClient';
import {engineModeUsesModulation, mapStateToNativeAudio} from '../audio/engineModeMapping';
import {useHertzStore} from '../state/store';

const TICK_MS = 32;

/**
 * While playing, applies time-varying gain / phase / balance for non-binaural modes.
 */
export function useEngineModeModulation(): void {
  const engineType = useHertzStore(s => s.engineType);
  const isPlaying = useHertzStore(s => s.isPlaying);

  const startMsRef = useRef(Date.now());

  useEffect(() => {
    startMsRef.current = Date.now();
  }, [engineType]);

  useEffect(() => {
    if (!isPlaying || !engineModeUsesModulation(engineType)) {
      const state = useHertzStore.getState();
      const mapped = mapStateToNativeAudio(state);
      HertzAudioClient.setBinauralParameters(mapped);
      HertzAudioClient.setPhaseAndTiming(mapped.phaseAngle, mapped.timingDiffMs);
      return;
    }

    const id = setInterval(() => {
      const state = useHertzStore.getState();
      if (!state.isPlaying || !engineModeUsesModulation(state.engineType)) {
        return;
      }

      const t = (Date.now() - startMsRef.current) / 1000;
      const mapped = mapStateToNativeAudio(state);
      const b = Math.max(0.05, state.beatHz);
      const g0 = mapped.gain;

      switch (state.engineType) {
        case 'monaural': {
          const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * b * t);
          HertzAudioClient.setBinauralParameters({...mapped, beatHz: 0, gain: g0 * am});
          break;
        }
        case 'isochronic': {
          const on = Math.sin(2 * Math.PI * b * t) > 0 ? 1 : 0;
          HertzAudioClient.setBinauralParameters({...mapped, beatHz: 0, gain: g0 * on});
          break;
        }
        case 'phaseModulated': {
          const phase = (t * b * 360) % 360;
          HertzAudioClient.setBinauralParameters(mapped);
          HertzAudioClient.setPhaseAndTiming(phase, mapped.timingDiffMs);
          break;
        }
        case 'pitchPanning': {
          const balance = Math.sin(2 * Math.PI * b * t);
          HertzAudioClient.setBinauralParameters({...mapped, balance});
          break;
        }
        default:
          break;
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [engineType, isPlaying]);
}
