const TWO_PI = Math.PI * 2;

/** Gamma / high-beta photic palette — high cortical penetration (Lee et al. 2021). */
const GAMMA_WHITE = {r: 255, g: 255, b: 255, peakOpacity: 1};
const GAMMA_RED = {r: 255, g: 0, b: 0, peakOpacity: 0.95};

/** Alpha / theta — greens & blues; still clearly visible when strobing. */
const THETA_GREEN = {r: 74, g: 222, b: 128, peakOpacity: 0.72};
const ALPHA_BLUE = {r: 96, g: 165, b: 250, peakOpacity: 0.68};

/** Default mid-band photic palette. */
const DEFAULT_PALETTE = {r: 180, g: 200, b: 255, peakOpacity: 0.75};

export type PhoticPalette = {
  r: number;
  g: number;
  b: number;
  peakOpacity: number;
};

/** Clinically informed color / luminance mapping by entrainment frequency (Hz). */
export function photicPaletteForBeatHz(beatHz: number): PhoticPalette {
  'worklet';
  const hz = Math.max(0.01, beatHz);
  if (hz >= 40) {
    return GAMMA_WHITE;
  }
  if (hz >= 30) {
    return GAMMA_RED;
  }
  if (hz >= 8) {
    return ALPHA_BLUE;
  }
  if (hz >= 4) {
    return THETA_GREEN;
  }
  return DEFAULT_PALETTE;
}

/**
 * Phase-aligned photic luminance 0…1 at `timeSec` for entrainment frequency `beatHz`.
 * Uses sin wave aligned with audio phase offset (degrees).
 */
export function photicLuminanceAtTime(
  timeSec: number,
  beatHz: number,
  phaseDeg: number,
): number {
  'worklet';
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const wave = Math.sin(TWO_PI * beatHz * timeSec + phaseRad);
  return (wave + 1) * 0.5;
}

/**
 * Square-wave photic drive — full on/off per half-cycle so flashes read clearly
 * on device (sinusoidal ramps at 40 Hz are easy to miss on a small canvas).
 */
export function photicFlashLuminanceAtTime(
  timeSec: number,
  beatHz: number,
  phaseDeg: number,
): number {
  'worklet';
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const wave = Math.sin(TWO_PI * beatHz * timeSec + phaseRad);
  return wave >= 0 ? 1 : 0;
}

/** Visual time aligned to native playback elapsed clock when playing. */
export function photicVisualTimeSec(
  frameTimestampMs: number,
  isPlaying: boolean,
  anchorFrameMs: number,
  anchorElapsedSec: number,
): number {
  'worklet';
  if (isPlaying) {
    return anchorElapsedSec + (frameTimestampMs - anchorFrameMs) / 1000;
  }
  return frameTimestampMs / 1000;
}
