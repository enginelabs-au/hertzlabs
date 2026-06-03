// @ts-nocheck — telemetry wiring not yet composed into AppStore (telemetry-js-wiring blocker)
import { shallow } from 'zustand/shallow';
import type { AppStore } from '../types';
import {
  gyroToPhase,
  rollToBalance,
  pitchToNoiseLevel,
  cadenceToBeatHz,
} from '../../audio/telemetryMapping';

type StoreApi = {
  getState: () => AppStore;
  subscribe: <T>(
    selector: (state: AppStore) => T,
    listener: (cur: T, prev: T) => void,
    options?: { equalityFn?: (a: T, b: T) => boolean }
  ) => () => void;
};

/**
 * Mounts subscribeWithSelector watchers that translate telemetry slice
 * deltas into audioParams setParam calls.
 *
 * Conflict policy: gyro-driven phaseAngle writes are suppressed while
 * gestureActive is true (gesture input takes priority). The gestureActiveRef
 * is a React ref forwarded from the PlayerScreen level.
 *
 * Returns an unsubscribe function.
 */
export function mountTelemetrySync(
  store: StoreApi,
  gestureActiveRef: { current: boolean }
): () => void {
  const unsubs: Array<() => void> = [];

  // Gyro → phaseAngle (suppressed during active gesture)
  unsubs.push(
    store.subscribe(
      (s) => s.gyroY,
      (gyroY) => {
        if (gestureActiveRef.current) return;
        const phase = gyroToPhase(gyroY);
        if (phase !== null) store.getState().setParam('phaseAngle', phase);
      }
    )
  );

  // Accel → shake reset (edge-triggered via shakeDetected flag)
  unsubs.push(
    store.subscribe(
      (s) => s.shakeDetected,
      (detected) => {
        if (!detected) return;
        const tier = store.getState().subscription.tier;
        store.getState().setParam('beatHz', 10);
        store.getState().setParam('gain', 0.3);
        // Increment shakeEventCount in session slice for analytics
        const cur = store.getState().session as { shakeEventCount?: number };
        if (typeof cur.shakeEventCount === 'number') {
          store.getState()._ingestSessionUpdate?.({ shakeEventCount: cur.shakeEventCount + 1 });
        }
      }
    )
  );

  // Roll → balance (premium only)
  unsubs.push(
    store.subscribe(
      (s) => s.attitude.roll,
      (roll) => {
        if (store.getState().subscription.tier !== 'premium') return;
        store.getState().setParam('balance', rollToBalance(roll));
      }
    )
  );

  // Pitch → noiseLevel
  unsubs.push(
    store.subscribe(
      (s) => s.attitude.pitch,
      (pitch) => {
        store.getState().setParam('noiseLevel', pitchToNoiseLevel(pitch));
      }
    )
  );

  // Cadence → beatHz (premium + cadenceSyncEnabled)
  unsubs.push(
    store.subscribe(
      (s) => ({
        cadence: s.stepCadence,
        enabled: (s.settings as { cadenceSyncEnabled?: boolean }).cadenceSyncEnabled ?? false,
        tier: s.subscription.tier,
      }),
      ({ cadence, enabled, tier }) => {
        if (!enabled || tier !== 'premium') return;
        store.getState().setParam('beatHz', cadenceToBeatHz(cadence));
      },
      { equalityFn: shallow }
    )
  );

  return () => unsubs.forEach((u) => u());
}
