import type {SubscriptionTier} from '../state/types';
import {beatHzLimitsForTier} from './beatHzSlider';

/**
 * Sensor → audio parameter transformation formulas.
 * All inputs are normalized [0, 1] floats from the telemetry slice.
 * All outputs are in the domain of the relevant audioParams key.
 */

/**
 * Device roll (left/right tilt) → beat frequency across the active tier range.
 * 0 = min Hz, 1 = max Hz; 0.5 ≈ level device.
 */
export function rollToBeatHz(normalizedRoll: number, tier: SubscriptionTier): number {
  const {min, max} = beatHzLimitsForTier(tier);
  const roll = Math.min(1, Math.max(0, normalizedRoll));
  return min + roll * (max - min);
}

/**
 * Device pitch (up/down tilt) → phase angle in degrees [0, 360].
 */
export function pitchToPhase(normalizedPitch: number): number {
  const pitch = Math.min(1, Math.max(0, normalizedPitch));
  return pitch * 360;
}

/**
 * Gyro Y-axis → phase angle in degrees [0, 360].
 * Returns null if the raw rotation is below the 0.1 rad/s activity threshold.
 * @deprecated Kinetic mode uses pitch→phase; kept for legacy telemetry paths.
 */
export function gyroToPhase(normalizedGyroY: number): number | null {
  const gyroRaw = normalizedGyroY * 2 * Math.PI - Math.PI;
  if (Math.abs(gyroRaw) <= 0.1) return null;
  return Math.min(360, gyroRaw * 50);
}

/**
 * Attitude roll → stereo balance [-1, +1].
 * normalizedRoll 0.5 = device level = balance 0.
 */
export function rollToBalance(normalizedRoll: number): number {
  return (normalizedRoll - 0.5) * 2;
}

/**
 * Attitude pitch → noise level [0, 1].
 */
export function pitchToNoiseLevel(normalizedPitch: number): number {
  return normalizedPitch;
}

/**
 * Compass heading → earth sequence mix [0, 1].
 */
export function headingToEarthMix(normalizedHeading: number): number {
  return normalizedHeading;
}

/**
 * Step cadence → beat frequency [10, 40] Hz.
 */
export function cadenceToBeatHz(normalizedCadence: number): number {
  return 10 + normalizedCadence * 30;
}
