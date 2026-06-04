import {useEffect} from 'react';
import type {DialValues} from '../components/CircularController/useDialSharedValues';
import {useHertzStore} from '../state/store';

/**
 * Syncs Zustand audio params into dial shared values.
 * Assigns from the JS thread (no runOnUI — avoids bridge queue errors).
 */
export function useAudioSharedValues(dialValues: DialValues) {
  const {carrierHz, beatHz, phaseAngle, timingDiffMs} = dialValues;

  useEffect(() => {
    const unsubscribe = useHertzStore.subscribe(
      state => ({
        carrierHz: state.carrierHz,
        beatHz: state.beatHz,
        phaseAngle: state.phaseAngle,
        leftDriftHz: state.leftDriftHz,
        rightDriftHz: state.rightDriftHz,
        gain: state.gain,
        balance: state.balance,
      }),
      ({
        carrierHz: cHz,
        beatHz: bHz,
        phaseAngle: pA,
        gain,
        balance,
      }) => {
        carrierHz.value = cHz;
        beatHz.value = bHz;
        phaseAngle.value = pA;
        timingDiffMs.value = 0;
        dialValues.gain.value = gain;
        dialValues.balance.value = balance;
      },
      {
        fireImmediately: true,
        equalityFn: (a, b) =>
          a.carrierHz === b.carrierHz &&
          a.beatHz === b.beatHz &&
          a.phaseAngle === b.phaseAngle &&
          a.leftDriftHz === b.leftDriftHz &&
          a.rightDriftHz === b.rightDriftHz &&
          a.gain === b.gain &&
          a.balance === b.balance,
      },
    );
    return unsubscribe;
  }, [carrierHz, beatHz, phaseAngle, timingDiffMs, dialValues.gain, dialValues.balance]);
}
