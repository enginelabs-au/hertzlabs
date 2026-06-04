import {useCallback} from 'react';
import {Gesture} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import type {DialValues} from './useDialSharedValues';
import {useHertzStore} from '../../state/store';

type CommitParams = {
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
};

const PHASE_SCALE = 0.5;
const CARRIER_SCALE = 200 / Math.PI;

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function useDialGestures(dialValues: DialValues) {
  const {carrierHz, beatHz, phaseAngle, rotationRad, gestureActive, axisLock} = dialValues;

  const setParam = useHertzStore(state => state.setParam);

  const flushToStore = useCallback(
    (params: CommitParams) => {
      setParam('carrierHz', params.carrierHz);
      setParam('beatHz', params.beatHz);
      setParam('phaseAngle', params.phaseAngle);
    },
    [setParam],
  );

  const panGesture = Gesture.Pan()
    .onBegin(e => {
      'worklet';
      axisLock.value =
        Math.abs(e.velocityY) > Math.abs(e.velocityX) ? 'vertical' : 'horizontal';
      gestureActive.value = true;
    })
    .onUpdate(e => {
      'worklet';
      if (axisLock.value === 'vertical') {
        phaseAngle.value = clamp(phaseAngle.value - e.translationY * PHASE_SCALE, 0, 360);
      }
    })
    .onEnd(() => {
      'worklet';
      axisLock.value = 'none';
      gestureActive.value = false;
      runOnJS(flushToStore)({
        carrierHz: carrierHz.value,
        beatHz: beatHz.value,
        phaseAngle: phaseAngle.value,
      });
    });

  const rotationGesture = Gesture.Rotation()
    .onBegin(() => {
      'worklet';
      gestureActive.value = true;
    })
    .onUpdate(e => {
      'worklet';
      const delta = e.rotation - rotationRad.value;
      rotationRad.value = e.rotation;
      carrierHz.value = clamp(carrierHz.value + delta * CARRIER_SCALE, 20, 1500);
    })
    .onEnd(() => {
      'worklet';
      gestureActive.value = false;
      runOnJS(flushToStore)({
        carrierHz: carrierHz.value,
        beatHz: beatHz.value,
        phaseAngle: phaseAngle.value,
      });
    });

  const composedGesture = Gesture.Simultaneous(rotationGesture, panGesture);

  return {composedGesture};
}
