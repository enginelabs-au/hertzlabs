import {useCallback, useEffect, useRef} from 'react';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import type {DialValues} from '../components/CircularController/useDialSharedValues';
import {HertzAudioClient} from '../audio/HertzAudioClient';
import {mapStateToNativeAudio} from '../audio/engineModeMapping';
import {useHertzStore} from '../state/store';

/** ~30 Hz cap on native param pushes; the engine ramps between them. */
const MIN_PUSH_MS = 33;

type LiveParams = {c: number; b: number; p: number; g: number; bal: number};

/**
 * Streams live UI-thread dial/slider values to the native audio engine *during*
 * a drag so the tone follows the control in real time. The Zustand store still
 * commits once on release (setParam → audioSync), so there is no per-frame React
 * churn. Pushes are throttled with a trailing edge and reuse the exact release
 * mapping (mapStateToNativeAudio), so the hand-off at release is seamless and the
 * engine's built-in ramps prevent zipper/crackle.
 */
export function useLiveAudioParamBridge(dialValues: DialValues): void {
  const lastPushMs = useRef(0);
  const pending = useRef<LiveParams | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    lastPushMs.current = Date.now();
    const v = pending.current;
    pending.current = null;
    if (v == null) {
      return;
    }
    const s = useHertzStore.getState();
    if (!s.isPlaying) {
      return;
    }
    const mapped = mapStateToNativeAudio({
      ...s,
      carrierHz: v.c,
      beatHz: v.b,
      phaseAngle: v.p,
      gain: v.g,
      balance: v.bal,
    });
    HertzAudioClient.setBinauralParameters(mapped, {
      layers: s.noiseLayers,
      mix: s.noiseMix,
    });
    HertzAudioClient.setPhaseAndTiming(mapped.phaseAngle, mapped.timingDiffMs);
  }, []);

  const schedulePush = useCallback(
    (c: number, b: number, p: number, g: number, bal: number) => {
      pending.current = {c, b, p, g, bal};
      const elapsed = Date.now() - lastPushMs.current;
      if (elapsed >= MIN_PUSH_MS) {
        flush();
      } else if (timer.current == null) {
        timer.current = setTimeout(flush, MIN_PUSH_MS - elapsed);
      }
    },
    [flush],
  );

  useAnimatedReaction(
    () => {
      // Quantize so runOnJS only fires on an audibly meaningful change.
      return {
        c: Math.round(dialValues.carrierHz.value * 2) / 2,
        b: Math.round(dialValues.beatHz.value * 10) / 10,
        p: Math.round(dialValues.phaseAngle.value),
        g: Math.round(dialValues.gain.value * 100) / 100,
        bal: Math.round(dialValues.balance.value * 100) / 100,
      };
    },
    (curr, prev) => {
      if (
        prev == null ||
        curr.c !== prev.c ||
        curr.b !== prev.b ||
        curr.p !== prev.p ||
        curr.g !== prev.g ||
        curr.bal !== prev.bal
      ) {
        runOnJS(schedulePush)(curr.c, curr.b, curr.p, curr.g, curr.bal);
      }
    },
    [schedulePush],
  );

  useEffect(() => {
    return () => {
      if (timer.current != null) {
        clearTimeout(timer.current);
      }
    };
  }, []);
}
