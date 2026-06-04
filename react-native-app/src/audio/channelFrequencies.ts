/** Per-ear frequency offset from binaural L/R (does not change TARGET beat slider). */
export const MIN_DRIFT_HZ = -12;
export const MAX_DRIFT_HZ = 12;

export type ChannelHz = {leftHz: number; rightHz: number};

export function clampDriftHz(hz: number): number {
  'worklet';
  if (!Number.isFinite(hz)) {
    return 0;
  }
  return Math.min(MAX_DRIFT_HZ, Math.max(MIN_DRIFT_HZ, hz));
}

/** L/R tone Hz from carrier, beat differential, and per-channel drift. */
export function channelFrequencies(
  carrierHz: number,
  beatHz: number,
  leftDriftHz: number,
  rightDriftHz: number,
): ChannelHz {
  'worklet';
  const c = Math.max(20, carrierHz);
  const b = Math.max(0, beatHz);
  const dl = clampDriftHz(leftDriftHz);
  const dr = clampDriftHz(rightDriftHz);
  return {
    leftHz: Math.max(0.5, c - b * 0.5 + dl),
    rightHz: Math.max(0.5, c + b * 0.5 + dr),
  };
}

/** Map effective L/R back to native carrier + beat (drift folded into oscillator). */
export function nativeBinauralFromChannels(leftHz: number, rightHz: number): {
  carrierHz: number;
  beatHz: number;
} {
  const left = Math.max(0.5, leftHz);
  const right = Math.max(0.5, rightHz);
  return {
    carrierHz: (left + right) / 2,
    beatHz: Math.max(0.05, right - left),
  };
}

export function driftNormFromHz(hz: number): number {
  return (clampDriftHz(hz) - MIN_DRIFT_HZ) / (MAX_DRIFT_HZ - MIN_DRIFT_HZ);
}

export function driftHzFromNorm(norm: number): number {
  const n = Math.min(1, Math.max(0, norm));
  return MIN_DRIFT_HZ + n * (MAX_DRIFT_HZ - MIN_DRIFT_HZ);
}
