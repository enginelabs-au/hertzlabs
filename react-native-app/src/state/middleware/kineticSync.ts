import {shallow} from 'zustand/shallow';
import type {AppStore} from '../types';
import {pitchToPhase, rollToBeatHz} from '../../audio/telemetryMapping';

type StoreApi = {
  getState: () => AppStore;
  subscribe: <T>(
    selector: (state: AppStore) => T,
    listener: (cur: T, prev: T) => void,
    options?: {equalityFn?: (a: T, b: T) => boolean},
  ) => () => void;
};

/**
 * When kinetic mode is on, maps device tilt to audio params:
 * roll (left/right) → beatHz, pitch (up/down) → phaseAngle.
 * Applies in every engine mode via the shared audio param path.
 */
export function mountKineticSync(
  store: StoreApi,
  gestureActiveRef: {current: boolean},
): () => void {
  return store.subscribe(
    s => ({
      kinetic: s.isKineticModeEnabled,
      roll: s.attitude.roll,
      pitch: s.attitude.pitch,
      tier: s.tier,
    }),
    (next, prev) => {
      if (!next.kinetic || gestureActiveRef.current) {
        return;
      }
      if (
        prev != null &&
        Math.abs(next.roll - prev.roll) < 0.002 &&
        Math.abs(next.pitch - prev.pitch) < 0.002
      ) {
        return;
      }
      const beatHz = rollToBeatHz(next.roll, next.tier);
      const phaseAngle = pitchToPhase(next.pitch);
      store.getState().setParam('beatHz', beatHz);
      store.getState().setParam('phaseAngle', phaseAngle);
    },
    {equalityFn: shallow},
  );
}
