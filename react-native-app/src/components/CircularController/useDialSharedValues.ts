import {useMemo} from 'react';
import {useSharedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {DEFAULT_BEAT_HZ, DEFAULT_CARRIER_HZ} from '../../audio/paramMapping';

/**
 * All six shared values that drive the circular controller, shader uniforms,
 * readout panel, and Zustand commit bridge. Declared as a unit so they can be
 * passed as a single prop without prop-drilling through intermediate layout nodes.
 */
export interface DialValues {
  carrierHz: SharedValue<number>;
  beatHz: SharedValue<number>;
  phaseAngle: SharedValue<number>;
  timingDiffMs: SharedValue<number>;
  gain: SharedValue<number>;
  balance: SharedValue<number>;
  rotationRad: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  axisLock: SharedValue<'vertical' | 'horizontal' | 'none'>;
}

/**
 * All values live on the UI thread. Initial defaults match the brainwave Alpha
 * band (beatHz = 10 Hz) at 220 Hz carrier with neutral phase and timing.
 */
export function useDialSharedValues(): DialValues {
  const carrierHz = useSharedValue(DEFAULT_CARRIER_HZ);
  const beatHz = useSharedValue(DEFAULT_BEAT_HZ);
  const phaseAngle = useSharedValue(0);
  const timingDiffMs = useSharedValue(0);
  const gain = useSharedValue(0.45);
  const balance = useSharedValue(0);
  const rotationRad = useSharedValue(0);
  const gestureActive = useSharedValue(false);
  const axisLock = useSharedValue<'vertical' | 'horizontal' | 'none'>('none');
  return useMemo(
    () => ({
      carrierHz,
      beatHz,
      phaseAngle,
      timingDiffMs,
      gain,
      balance,
      rotationRad,
      gestureActive,
      axisLock,
    }),
    [
      carrierHz,
      beatHz,
      phaseAngle,
      timingDiffMs,
      gain,
      balance,
      rotationRad,
      gestureActive,
      axisLock,
    ],
  );
}
