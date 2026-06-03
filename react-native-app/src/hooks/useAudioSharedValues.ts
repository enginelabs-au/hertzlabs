import {useEffect} from 'react';
import {runOnUI} from 'react-native-reanimated';
import type {DialValues} from '../components/CircularController/useDialSharedValues';
import {useHertzStore} from '../state/store';

/**
 * Subscribes to Zustand `carrierHz` + `beatHz` on mount and syncs them into
 * the shared values via `runOnUI`. This handles store→UI-thread direction:
 * preset loads, AI suggestions, or telemetry updates reflect in the dial without
 * a React re-render cycle.
 *
 * The gesture path (dial→Zustand) runs separately in `useDialGestures`.
 */
export function useAudioSharedValues(dialValues: DialValues) {
  const {carrierHz, beatHz, phaseAngle, timingDiffMs} = dialValues;

  useEffect(() => {
    const unsubscribe = useHertzStore.subscribe(
      state => ({
        carrierHz: state.carrierHz,
        beatHz: state.beatHz,
        phaseAngle: state.phaseAngle,
        timingDiffMs: state.timingDiffMs,
        gain: state.gain,
        balance: state.balance,
      }),
      ({carrierHz: cHz, beatHz: bHz, phaseAngle: pA, timingDiffMs: tD, gain, balance}) => {
        runOnUI(() => {
          'worklet';
          carrierHz.value = cHz;
          beatHz.value = bHz;
          phaseAngle.value = pA;
          timingDiffMs.value = tD;
          dialValues.gain.value = gain;
          dialValues.balance.value = balance;
        })();
      },
      {
        fireImmediately: true,
        equalityFn: (a, b) =>
          a.carrierHz === b.carrierHz &&
          a.beatHz === b.beatHz &&
          a.phaseAngle === b.phaseAngle &&
          a.timingDiffMs === b.timingDiffMs &&
          a.gain === b.gain &&
          a.balance === b.balance,
      },
    );
    return unsubscribe;
  }, [carrierHz, beatHz, phaseAngle, timingDiffMs, dialValues.gain, dialValues.balance]);
}
