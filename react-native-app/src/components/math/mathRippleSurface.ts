import type {AudioSurfaceParams} from '../../audio/binauralSurfaceMath';
import {sanitizeAudioSurfaceParams} from '../../audio/binauralSurfaceMath';

export type {AudioSurfaceParams} from '../../audio/binauralSurfaceMath';
export {sanitizeAudioSurfaceParams} from '../../audio/binauralSurfaceMath';

/** Ring density from TARGET beat (Hz). */
export function radialKFromBeatHz(beatHz: number): number {
  const hz = Math.max(0.05, beatHz);
  return Math.min(5.5, Math.max(0.65, Math.sqrt(hz) * 0.95));
}

/** How fast circular ripples travel outward (matches TARGET beat Hz). */
export function pondRipplePhaseSpeed(beatHz: number): number {
  return Math.max(0.05, beatHz);
}

/** Vertical exaggeration of ripple height before projection (peaks/troughs). */
export const POND_DEPTH_GAIN = 1.52;

/**
 * Pond splash height — radial sinc rings (circular ripples from centre).
 * Phase, beat, and gain come from the live audio settings.
 */
export function pondRippleHeight(
  x: number,
  y: number,
  timeSec: number,
  audio: AudioSurfaceParams,
): number {
  const a = sanitizeAudioSurfaceParams(audio);
  const r = Math.sqrt(x * x + y * y);
  const radialK = radialKFromBeatHz(a.beatHz);
  const phase =
    timeSec * pondRipplePhaseSpeed(a.beatHz) * Math.PI * 2 + (a.phaseAngle * Math.PI) / 180;
  const denom = 0.28 + r * 0.74;
  const z =
    (Math.sin(radialK * r - phase) / denom) * 1.48 * POND_DEPTH_GAIN * Math.max(0.15, a.gain);
  return Math.max(-1.15, Math.min(1.15, z));
}

type Rgb = {r: number; g: number; b: number};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

const BLUE: Rgb = {r: 8, g: 28, b: 110};
const CYAN: Rgb = {r: 0, g: 200, b: 232};
const LIME: Rgb = {r: 120, g: 230, b: 80};
const RED: Rgb = {r: 255, g: 55, b: 45};

export function colorForHeight(z: number): string {
  const t = (z + 1) * 0.5;
  let rgb: Rgb;
  if (t < 0.33) {
    rgb = lerpRgb(BLUE, CYAN, t / 0.33);
  } else if (t < 0.66) {
    rgb = lerpRgb(CYAN, LIME, (t - 0.33) / 0.33);
  } else {
    rgb = lerpRgb(LIME, RED, (t - 0.66) / 0.34);
  }
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}

export type ProjectedPoint = {sx: number; sy: number; z: number};

export type SurfaceProjectionOpts = {
  /** Scales the 3D wave mesh inside the plot (not the axis frame). Default 1. */
  meshScale?: number;
  /** Multiplies Z before isometric rotation (deeper relief). Default 1.38. */
  zDepthScale?: number;
  yawOffset?: number;
  pitchOffset?: number;
};

/** Isometric lab-plot angle (reference screenshot). */
export function projectSurfaceIsometric(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  opts: SurfaceProjectionOpts = {},
): ProjectedPoint {
  const meshScale = opts.meshScale ?? 1;
  const zDepth = z * (opts.zDepthScale ?? 1.38);
  const yaw = 0.68 + (opts.yawOffset ?? 0);
  const pitch = 0.5 + (opts.pitchOffset ?? 0);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const xr = x * cosY + zDepth * sinY;
  const zr = -x * sinY + zDepth * cosY;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const yr = y * cosP - zr * sinP;
  const zf = y * sinP + zr * cosP;
  const persp = 1 / (2.75 + zf * 0.2);
  const scale = Math.min(width, height) * 0.092 * meshScale;
  return {
    sx: width * 0.5 + xr * scale * persp,
    sy: height * 0.54 - yr * scale * persp,
    z: zf,
  };
}
