import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

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
  rotationRad: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  axisLock: SharedValue<'vertical' | 'horizontal' | 'none'>;
}

/**
 * All values live on the UI thread. Initial defaults match the brainwave Alpha
 * band (beatHz = 10 Hz) at 200 Hz carrier with neutral phase and timing.
 */
export function useDialSharedValues(): DialValues {
  const carrierHz = useSharedValue(200);
  const beatHz = useSharedValue(10);
  const phaseAngle = useSharedValue(0);
  const timingDiffMs = useSharedValue(0);
  const rotationRad = useSharedValue(0);
  const gestureActive = useSharedValue(false);
  const axisLock = useSharedValue<'vertical' | 'horizontal' | 'none'>('none');

  return {
    carrierHz,
    beatHz,
    phaseAngle,
    timingDiffMs,
    rotationRad,
    gestureActive,
    axisLock,
  };
}
