import {HertzAudioClient} from '../../audio/HertzAudioClient';
import {mapStateToNativeAudio} from '../../audio/engineModeMapping';
import {DEFAULT_BEAT_HZ, MAX_BEAT_HZ} from '../../audio/paramMapping';
import {isExperimentalModeActive, isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {useHertzStore} from '../../state/store';

/** Push the current store snapshot to native audio immediately (not only on release). */
export function pushNativeAudioNow(): void {
  const s = useHertzStore.getState();
  const mapped = mapStateToNativeAudio(s);
  HertzAudioClient.setPhaseAndTiming(mapped.phaseAngle, mapped.timingDiffMs);
  HertzAudioClient.setBinauralParameters(mapped, {
    layers: s.noiseLayers,
    mix: s.noiseMix,
  });
}

/** Apply an evaluated formula Hz to the live session (beat or carrier when high). */
export function applyFormulaEvalToSession(hz: number): void {
  const s = useHertzStore.getState();
  const experimental = isExperimentalModeActive(s.tier, s.experimentalMode);

  if (hz > MAX_BEAT_HZ && isPremiumUnlocked(s.tier)) {
    s.setParam('carrierHz', hz);
    s.setParam('beatHz', DEFAULT_BEAT_HZ);
  } else {
    s.setParam('beatHz', hz);
    if (!experimental) {
      s.setParam('carrierHz', 220);
    }
  }

  pushNativeAudioNow();
}
