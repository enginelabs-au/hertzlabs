// @ts-nocheck — telemetry wiring not yet composed into AppStore (telemetry-js-wiring blocker)
import { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { useHertzStore } from '../state/store';
import { mountTelemetrySync } from '../state/middleware/telemetrySync';
import type { TelemetryUpdateEvent } from '../audio/specs/NativeHertzTelemetry';

const { HertzTelemetry } = NativeModules;
const telemetryEmitter = HertzTelemetry
  ? new NativeEventEmitter(HertzTelemetry)
  : null;

/**
 * Mounts the native telemetry event listeners, ingests data into the
 * telemetry Zustand slice, and activates the telemetrySync middleware.
 *
 * gestureActiveRef should be a ref shared from the PlayerScreen that
 * reflects whether a dial gesture is currently in progress.
 */
export function useTelemetrySync(gestureActiveRef: { current: boolean }) {
  const store = useHertzStore;
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!telemetryEmitter) return;

    // Start sensors at 100 ms default interval
    HertzTelemetry.startSensors(100);
    store.getState().setSensorActive(true);

    const updateSub = telemetryEmitter.addListener(
      'onTelemetryUpdate',
      (event: TelemetryUpdateEvent) => {
        store.getState()._ingestTelemetry({
          gyroY: event.gyroY,
          accelMagnitude: event.accelMagnitude,
          attitude: {
            roll: event.roll,
            pitch: event.pitch,
            yaw: event.yaw,
          },
          heading: event.heading,
          stepCadence: event.stepCadence,
          shakeDetected: event.shakeDetected,
          sensorActive: event.sensorActive,
        });
      }
    );

    const sleepSub = telemetryEmitter.addListener('onTelemetrySleep', () => {
      store.getState().setSensorActive(false);
    });

    unsubRef.current = mountTelemetrySync(
      {
        getState: () => store.getState(),
        subscribe: store.subscribe as never,
      },
      gestureActiveRef
    );

    return () => {
      HertzTelemetry?.stopSensors();
      store.getState().setSensorActive(false);
      updateSub.remove();
      sleepSub.remove();
      unsubRef.current?.();
    };
  }, []);
}
