import {useEffect, useRef} from 'react';
import {HertzAudioClient} from '../audio/HertzAudioClient';
import {engineModeUsesModulation, mapStateToNativeAudio} from '../audio/engineModeMapping';
import {useHertzStore} from '../state/store';

function pushMappedWithNoise(mapped: ReturnType<typeof mapStateToNativeAudio>): void {
  const s = useHertzStore.getState();
  HertzAudioClient.setBinauralParameters(mapped, {layers: s.noiseLayers, mix: s.noiseMix});
}

/** Native gain smoothing is ~80 ms; avoid updating faster than that. */
const TICK_MS = 48;

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
      pushMappedWithNoise(mapped);
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
          pushMappedWithNoise({...mapped, beatHz: 0, gain: g0 * am});
          break;
        }
        case 'isochronic': {
          // Half-wave rectified sine — avoids hard on/off clicks from a square envelope.
          const env = Math.max(0, Math.sin(2 * Math.PI * b * t));
          pushMappedWithNoise({...mapped, beatHz: 0, gain: g0 * env});
          break;
        }
        case 'phaseModulated': {
          const phase = (t * b * 360) % 360;
          pushMappedWithNoise(mapped);
          HertzAudioClient.setPhaseAndTiming(phase, mapped.timingDiffMs);
          break;
        }
        case 'pitchPanning': {
          const balance = Math.sin(2 * Math.PI * b * t);
          pushMappedWithNoise({...mapped, balance});
          break;
        }
        default:
          break;
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [engineType, isPlaying]);
}
