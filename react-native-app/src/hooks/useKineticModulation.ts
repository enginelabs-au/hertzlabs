import {useEffect, useRef, useCallback} from 'react';
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

const SHAKE_G_THRESHOLD = 2.5;
const PANIC_RESET_HZ = 10;
const PANIC_RESET_CARRIER = 220;

const GYRO_INTERVAL_MS = 50;
const ACCEL_INTERVAL_MS = 100;
/** Avoid setParam / audioSync / useAudioSharedValues storms while kinetic is on. */
const PHASE_COMMIT_MS = 200;

/**
 * Kinematic modulation hook (Annexure C).
 *
 * Stub implementation for simulator compatibility.
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
  const phaseCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPhaseRef = useRef(0);

  const flushPhase = useCallback(() => {
    setParam('phaseAngle', pendingPhaseRef.current);
    phaseCommitTimerRef.current = null;
  }, [setParam]);

  const simulateGyro = useCallback(() => {
    if (!isKineticModeEnabled) {
      return;
    }
    const t = Date.now() / 3000;
    const rawY = Math.sin(t) * 0.15;
    const normalized = Math.max(0, Math.min(1, 0.5 + rawY));
    frameRef.current = {...frameRef.current, gyroY: normalized};

    const phaseAngle = normalized * 360;
    pendingPhaseRef.current = phaseAngle;

    if (phaseCommitTimerRef.current != null) {
      clearTimeout(phaseCommitTimerRef.current);
    }
    phaseCommitTimerRef.current = setTimeout(flushPhase, PHASE_COMMIT_MS);
  }, [isKineticModeEnabled, flushPhase]);

  const simulateAccel = useCallback(() => {
    if (!isKineticModeEnabled) {
      return;
    }
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
      if (phaseCommitTimerRef.current != null) {
        clearTimeout(phaseCommitTimerRef.current);
        phaseCommitTimerRef.current = null;
      }
    };
  }, [isKineticModeEnabled, simulateGyro, simulateAccel]);

  return {
    isActive: isKineticModeEnabled,
    lastFrame: frameRef.current,
    shakeDetected: shakeRef.current,
  };
}

export function isShakeEvent(gForceMagnitude: number): boolean {
  return gForceMagnitude > SHAKE_G_THRESHOLD;
}

export function applyPanicReset(setParam: (key: 'beatHz' | 'carrierHz', v: number) => void): void {
  setParam('beatHz', PANIC_RESET_HZ);
  setParam('carrierHz', PANIC_RESET_CARRIER);
}
