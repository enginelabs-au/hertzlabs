import {useEffect, useRef, useCallback} from 'react';
import {useHertzStore} from '../state/store';

/** Sensor reading normalized to 0.0–1.0 */
export interface NormalizedSensorFrame {
  gyroY: number;       // Rotation rate Y-axis → phase angle mapping
  accelMag: number;    // Accelerometer magnitude → panic reset trigger
  roll: number;        // Attitude roll → stereo balance
  pitch: number;       // Attitude pitch → noise level
}

export interface KineticModulationState {
  isActive: boolean;
  lastFrame: NormalizedSensorFrame;
  shakeDetected: boolean;
}

const SHAKE_G_THRESHOLD = 2.5;
const PANIC_RESET_HZ = 10;
const PANIC_RESET_CARRIER = 220;

const GYRO_INTERVAL_MS = 50;
const ACCEL_INTERVAL_MS = 100;

/**
 * Kinematic modulation hook (Annexure C).
 *
 * Stub implementation for simulator compatibility:
 * - Gyroscope (50 ms): rotation rate Y → phase angle [0..360°]
 * - Accelerometer (100 ms): magnitude > 2.5 G → panic reset to 10 Hz Alpha
 * - All values normalized 0.0–1.0 before Zustand injection
 *
 * When a native sensor bridge is available, replace the stub generators
 * below with actual NativeHertzTelemetry event listeners.
 */
export function useKineticModulation(): KineticModulationState {
  const isKineticModeEnabled = useHertzStore(s => s.isKineticModeEnabled);
  const setParam = useHertzStore(s => s.setParam);

  const frameRef = useRef<NormalizedSensorFrame>({
    gyroY: 0.5,
    accelMag: 0,
    roll: 0.5,
    pitch: 0.5,
  });
  const shakeRef = useRef(false);

  // Stub: simulate gentle gyro drift for visual demo purposes.
  // In production: subscribe to NativeHertzTelemetry events instead.
  const simulateGyro = useCallback(() => {
    if (!isKineticModeEnabled) {
      return;
    }
    // Gentle sinusoidal drift to show the feature is active visually.
    const t = Date.now() / 3000;
    const rawY = Math.sin(t) * 0.15; // ±15% of max range
    const normalized = Math.max(0, Math.min(1, 0.5 + rawY));
    frameRef.current = {...frameRef.current, gyroY: normalized};

    // Map gyro Y [0..1] → phase angle [0..360°]
    const phaseAngle = normalized * 360;
    setParam('phaseAngle', phaseAngle);
  }, [isKineticModeEnabled, setParam]);

  const simulateAccel = useCallback(() => {
    if (!isKineticModeEnabled) {
      return;
    }
    // No simulated shake in stub — stays calm.
    frameRef.current = {...frameRef.current, accelMag: 0};
    shakeRef.current = false;
  }, [isKineticModeEnabled]);

  useEffect(() => {
    if (!isKineticModeEnabled) {
      return;
    }

    const gyroTimer = setInterval(simulateGyro, GYRO_INTERVAL_MS);
    const accelTimer = setInterval(simulateAccel, ACCEL_INTERVAL_MS);

    return () => {
      clearInterval(gyroTimer);
      clearInterval(accelTimer);
    };
  }, [isKineticModeEnabled, simulateGyro, simulateAccel]);

  return {
    isActive: isKineticModeEnabled,
    lastFrame: frameRef.current,
    shakeDetected: shakeRef.current,
  };
}

/**
 * Exported utility: given a raw accelerometer magnitude in G-force units,
 * returns true if shake threshold is crossed. Used by native event bridge.
 */
export function isShakeEvent(gForceMagnitude: number): boolean {
  return gForceMagnitude > SHAKE_G_THRESHOLD;
}

/**
 * Exported utility: panic reset to 10 Hz Alpha.
 * Call this from the native shake event handler.
 */
export function applyPanicReset(setParam: (key: 'beatHz' | 'carrierHz', v: number) => void): void {
  setParam('beatHz', PANIC_RESET_HZ);
  setParam('carrierHz', PANIC_RESET_CARRIER);
}
