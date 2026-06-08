import {useCallback, useEffect, useRef} from 'react';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import type {DialValues} from '../components/CircularController/useDialSharedValues';
import NativeHertzTelemetry from '../audio/specs/NativeHertzTelemetry';
import {mountKineticSync} from '../state/middleware/kineticSync';
import {useHertzStore} from '../state/store';

/** Sensor reading normalized to 0.0–1.0 */
export interface NormalizedSensorFrame {
  gyroY: number;
  accelMag: number;
  roll: number;
  pitch: number;
}

export interface KineticModulationState {
  isActive: boolean;
  lastFrame: NormalizedSensorFrame;
  shakeDetected: boolean;
}

const SENSOR_INTERVAL_MS = 50;

function accelMagnitude(event: {
  accelX: number;
  accelY: number;
  accelZ: number;
}): number {
  const ax = event.accelX * 4 - 2;
  const ay = event.accelY * 4 - 2;
  const az = event.accelZ * 4 - 2;
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

/**
 * Kinetic mode: live device tilt drives beat frequency (roll) and phase (pitch).
 */
export function useKineticModulation(dialValues: DialValues): KineticModulationState {
  const isKineticModeEnabled = useHertzStore(s => s.isKineticModeEnabled);
  const gestureActiveRef = useRef(false);
  const frameRef = useRef<NormalizedSensorFrame>({
    gyroY: 0.5,
    accelMag: 0,
    roll: 0.5,
    pitch: 0.5,
  });
  const shakeRef = useRef(false);

  const setGestureActive = useCallback((v: boolean) => {
    gestureActiveRef.current = v;
  }, []);

  useAnimatedReaction(
    () => dialValues.gestureActive.value,
    active => {
      runOnJS(setGestureActive)(active);
    },
    [setGestureActive],
  );

  useEffect(() => {
    if (!isKineticModeEnabled) {
      return;
    }

    const store = useHertzStore;

    NativeHertzTelemetry.startSensors(SENSOR_INTERVAL_MS);
    store.getState().setSensorActive(true);

    const updateSub = NativeHertzTelemetry.onTelemetryUpdate(event => {
        const mag = accelMagnitude(event);
        frameRef.current = {
          gyroY: event.gyroY,
          accelMag: mag,
          roll: event.roll,
          pitch: event.pitch,
        };
        shakeRef.current = event.shakeDetected;
        store.getState()._ingestTelemetry({
          gyroY: event.gyroY,
          accelMagnitude: mag,
          attitude: {
            roll: event.roll,
            pitch: event.pitch,
            yaw: event.yaw,
          },
          heading: event.heading,
          stepCadence: event.cadenceBpm ?? 0,
          shakeDetected: event.shakeDetected,
          sensorActive: true,
        });
    });

    const sleepSub = NativeHertzTelemetry.onTelemetrySleep(() => {
      store.getState().setSensorActive(false);
    });

    const unsubKinetic = mountKineticSync(
      {
        getState: () => store.getState(),
        subscribe: store.subscribe as never,
      },
      gestureActiveRef,
    );

    return () => {
      NativeHertzTelemetry.stopSensors();
      store.getState().setSensorActive(false);
      updateSub.remove();
      sleepSub.remove();
      unsubKinetic();
    };
  }, [isKineticModeEnabled]);

  return {
    isActive: isKineticModeEnabled,
    lastFrame: frameRef.current,
    shakeDetected: shakeRef.current,
  };
}
