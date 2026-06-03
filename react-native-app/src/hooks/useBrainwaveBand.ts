import {
  useSharedValue,
  useAnimatedReaction,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { BRAINWAVE_BANDS } from '../components/ReadoutPanel/brainwaveBands';

/**
 * Watches `beatHz` on the UI thread and maintains `bandIndex` (integer index
 * into BRAINWAVE_BANDS) and `bandOpacity` (cross-fade trigger).
 *
 * On band boundary crossing, fires withSequence(withTiming(0), withTiming(1))
 * on `bandOpacity` to cross-fade the BandLabel display.
 *
 * Uses a worklet-safe `for` loop — never `.find()` or other closure-heavy
 * methods that the Reanimated worklet compiler cannot inline.
 */
export function useBrainwaveBand(beatHz: SharedValue<number>) {
  const bandIndex = useSharedValue(3);
  const bandOpacity = useSharedValue(1);

  useAnimatedReaction(
    () => beatHz.value,
    (hz, prevHz) => {
      'worklet';
      if (hz === prevHz) {
        return;
      }

      let newIndex = BRAINWAVE_BANDS.length - 1;
      for (let i = 0; i < BRAINWAVE_BANDS.length; i++) {
        if (hz >= BRAINWAVE_BANDS[i].minHz && hz < BRAINWAVE_BANDS[i].maxHz) {
          newIndex = i;
          break;
        }
      }

      if (newIndex !== bandIndex.value) {
        bandIndex.value = newIndex;
        bandOpacity.value = withSequence(
          withTiming(0, { duration: 150 }),
          withTiming(1, { duration: 150 }),
        );
      }
    },
  );

  return { bandIndex, bandOpacity };
}
