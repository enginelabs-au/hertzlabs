import type {DialValues} from '../components/CircularController/useDialSharedValues';
import type {AppStore} from '../state/types';
import {runOnUI} from 'react-native-reanimated';

/**
 * Commit a band-chip / programmatic beat Hz change: clear gesture lock, sync the
 * UI-thread dial, and update store. audioSync pushes native params with engine
 * ramps — avoid a second immediate push here (causes audible clicks).
 */
export function commitBeatHzSelection(
  dialValues: DialValues | undefined,
  hz: number,
  setParam: AppStore['setParam'],
): void {
  if (dialValues != null) {
    runOnUI(() => {
      'worklet';
      dialValues.gestureActive.value = false;
      dialValues.beatHz.value = hz;
    })();
  }
  setParam('beatHz', hz);
}
