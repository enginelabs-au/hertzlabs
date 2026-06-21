import {useLayoutEffect} from 'react';
import type {DialValues} from '../components/CircularController/useDialSharedValues';
import {NATIVE_ENGINE_MODE_CODE} from '../audio/engineModeMapping';
import {useHertzStore} from '../state/store';

function syncDialFromStore(dialValues: DialValues): void {
  const state = useHertzStore.getState();
  dialValues.carrierHz.value = state.carrierHz;
  if (!dialValues.gestureActive.value) {
    dialValues.beatHz.value = state.beatHz;
    dialValues.phaseAngle.value = state.phaseAngle;
  }
  dialValues.timingDiffMs.value =
    NATIVE_ENGINE_MODE_CODE[state.engineType] ?? NATIVE_ENGINE_MODE_CODE.binaural;
  dialValues.gain.value = state.gain;
  dialValues.balance.value = state.balance;
}

/**
 * Syncs Zustand audio params into dial shared values.
 * useLayoutEffect + an immediate sync keeps dials aligned before paint/play.
 */
export function useAudioSharedValues(dialValues: DialValues) {
  const {carrierHz, beatHz, phaseAngle, timingDiffMs} = dialValues;

  useLayoutEffect(() => {
    syncDialFromStore(dialValues);

    const unsubscribe = useHertzStore.subscribe(
      state => ({
        carrierHz: state.carrierHz,
        beatHz: state.beatHz,
        phaseAngle: state.phaseAngle,
        leftDriftHz: state.leftDriftHz,
        rightDriftHz: state.rightDriftHz,
        gain: state.gain,
        balance: state.balance,
        engineType: state.engineType,
      }),
      ({
        carrierHz: cHz,
        beatHz: bHz,
        phaseAngle: pA,
        gain,
        balance,
        engineType,
      }) => {
        // While the user drags the beat slider / dial, the UI thread owns beatHz.
        // Overwriting from store here causes band taps to snap back to the old slider Hz.
        if (!dialValues.gestureActive.value) {
          carrierHz.value = cHz;
          beatHz.value = bHz;
          phaseAngle.value = pA;
        }
        timingDiffMs.value =
          NATIVE_ENGINE_MODE_CODE[engineType] ?? NATIVE_ENGINE_MODE_CODE.binaural;
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
          a.balance === b.balance &&
          a.engineType === b.engineType,
      },
    );
    return unsubscribe;
  }, [carrierHz, beatHz, phaseAngle, timingDiffMs, dialValues]);
}
