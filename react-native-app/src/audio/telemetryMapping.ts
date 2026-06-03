/**
 * Sensor → audio parameter transformation formulas.
 * All inputs are normalized [0, 1] floats from the telemetry slice.
 * All outputs are in the domain of the relevant audioParams key.
 */

/**
 * Gyro Y-axis → phase angle in degrees [0, 360].
 * Returns null if the raw rotation is below the 0.1 rad/s activity threshold.
 */
export function gyroToPhase(normalizedGyroY: number): number | null {
  // Denormalize: gyroY_raw = normalizedGyroY * 2π - π
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
 * Modulates the existing noiseLevel audioParam.
 */
export function pitchToNoiseLevel(normalizedPitch: number): number {
  return normalizedPitch;
}

/**
 * Compass heading → earth sequence mix [0, 1].
 * Direct pass-through until AmbientMixer module is designed.
 */
export function headingToEarthMix(normalizedHeading: number): number {
  return normalizedHeading;
}

/**
 * Step cadence → beat frequency [10, 40] Hz.
 * Plan 02 clamp (10…40 Hz) applies downstream in the TurboModule.
 */
export function cadenceToBeatHz(normalizedCadence: number): number {
  return 10 + normalizedCadence * 30;
}
