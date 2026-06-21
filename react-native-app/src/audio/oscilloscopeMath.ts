import type {SkPathBuilder} from '@shopify/react-native-skia';
import {Skia} from '@shopify/react-native-skia';

/**
 * Worklet-safe math matching native BinauralOscillatorNode DSP
 * (carrier ± beat/2, phase on right, balance law, -6 dBFS ceiling).
 */
const TWO_PI = 2 * Math.PI;
const MAX_AMP = 0.5011872336;

export type StereoHz = {leftHz: number; rightHz: number};

export function stereoHzFromBinaural(carrierHz: number, beatHz: number): StereoHz {
  'worklet';
  const b = Math.max(0, beatHz);
  const c = Math.max(20, carrierHz);
  return {
    leftHz: Math.max(0.001, c - b * 0.5),
    rightHz: Math.max(0.001, c + b * 0.5),
  };
}

export function binauralSample(
  tSec: number,
  leftHz: number,
  rightHz: number,
  phaseDeg: number,
  gain: number,
  balance: number,
): {left: number; right: number} {
  'worklet';
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const g = Math.min(Math.max(gain, 0), 1);
  const gL = Math.min(g * Math.max(0, 1 - balance), MAX_AMP);
  const gR = Math.min(g * Math.max(0, 1 + balance), MAX_AMP);
  const pL = TWO_PI * leftHz * tSec;
  const pR = TWO_PI * rightHz * tSec + phaseRad;
  return {
    left: Math.sin(pL) * gL,
    right: Math.sin(pR) * gR,
  };
}

/** Scrolling time-domain trace — append into PathBuilder (usePathValue). */
export function appendOscilloscopeTrace(
  builder: SkPathBuilder,
  opts: {
    length: number;
    center: number;
    amplitude: number;
    hz: number;
    timeSec: number;
    orientation: 'horizontal' | 'vertical';
    phaseRad?: number;
    gain?: number;
    maxSteps?: number;
    /** Widen the visible time window (leading edge stays at `timeSec` for audio sync). */
    traceSpanMul?: number;
  },
): void {
  'worklet';
  const {
    length,
    center,
    amplitude,
    hz,
    timeSec,
    orientation,
    phaseRad = 0,
    gain = 1,
    maxSteps,
    traceSpanMul = 1,
  } = opts;
  const steps = maxSteps ?? Math.max(120, Math.floor(length / 2));
  const windowSec = Math.max(1 / Math.max(hz, 0.05), 0.02) * Math.max(1, traceSpanMul);
  const g = Math.min(Math.max(gain, 0), 1) * MAX_AMP;

  for (let i = 0; i <= steps; i++) {
    const xNorm = i / steps;
    const t = timeSec - windowSec * (1 - xNorm);
    const sample = Math.sin(TWO_PI * hz * t + phaseRad) * g * amplitude;
    if (orientation === 'horizontal') {
      const x = xNorm * length;
      const y = center + sample;
      if (i === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    } else {
      const y = xNorm * length;
      const x = center + sample;
      if (i === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    }
  }
}

/** XY Lissajous figure — append into PathBuilder (usePathValue). */
export function appendLissajousPath(
  builder: SkPathBuilder,
  opts: {
    cx: number;
    cy: number;
    scale: number;
    leftHz: number;
    rightHz: number;
    phaseDeg: number;
    gain: number;
    balance: number;
    timeSec: number;
    pointCount?: number;
  },
): void {
  'worklet';
  const {
    cx,
    cy,
    scale,
    leftHz,
    rightHz,
    phaseDeg,
    gain,
    balance,
    timeSec,
    pointCount = 160,
  } = opts;
  const beat = Math.max(Math.abs(rightHz - leftHz), 0.05);
  const period = 1 / beat;
  const t0 = timeSec - period;

  for (let i = 0; i <= pointCount; i++) {
    const t = t0 + (i / pointCount) * period;
    const {left, right} = binauralSample(t, leftHz, rightHz, phaseDeg, gain, balance);
    const x = cx + left * scale;
    const y = cy + right * scale;
    if (i === 0) {
      builder.moveTo(x, y);
    } else {
      builder.lineTo(x, y);
    }
  }
}

/** @deprecated Prefer usePathValue + appendOscilloscopeTrace */
export function buildOscilloscopeTrace(opts: Parameters<typeof appendOscilloscopeTrace>[1]) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(builder, opts);
  return builder.build();
}

export type Lissajous3DLayerOpts = {
  cx: number;
  cy: number;
  scale: number;
  leftHz: number;
  rightHz: number;
  phaseDeg: number;
  gain: number;
  balance: number;
  timeSec: number;
  /** Y-axis rotation (radians) — tie to inter-aural phase for visible twist. */
  yawRad: number;
  pointCount?: number;
  /** Multiply |R−L| beat before choosing loop period (hub-only detune vs vsync). */
  beatPeriodScale?: number;
};

/**
 * Pseudo-3D Lissajous loop: L/R → XYZ, yaw rotation + perspective projection.
 * Phase shifts the right-channel component and depth (Z), so the figure visibly twists.
 */
export function appendLissajous3DLoop(builder: SkPathBuilder, opts: Lissajous3DLayerOpts): void {
  'worklet';
  const {
    cx,
    cy,
    scale,
    leftHz,
    rightHz,
    phaseDeg,
    gain,
    balance,
    timeSec,
    yawRad,
    pointCount = 150,
    beatPeriodScale = 1,
  } = opts;
  const phaseRad = (phaseDeg * Math.PI) / 180;
  const beat = Math.max(Math.abs(rightHz - leftHz), 0.05) * beatPeriodScale;
  const period = 1 / beat;
  const t0 = timeSec - period;
  const g = Math.min(Math.max(gain, 0), 1);
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);

  for (let i = 0; i <= pointCount; i++) {
    const t = t0 + (i / pointCount) * period;
    const {left, right} = binauralSample(t, leftHz, rightHz, phaseDeg, gain, balance);
    const x3 = left / MAX_AMP;
    const y3 = right / MAX_AMP;
    const z3 = Math.sin(TWO_PI * leftHz * t - TWO_PI * rightHz * t - phaseRad) * g * 0.72;
    const xr = x3 * cosY - z3 * sinY;
    const zr = x3 * sinY + z3 * cosY;
    const persp = 1 / (1.18 + zr * 0.38);
    const sx = cx + xr * scale * persp;
    const sy = cy + y3 * scale * persp * 0.8;
    if (i === 0) {
      builder.moveTo(sx, sy);
    } else {
      builder.lineTo(sx, sy);
    }
  }
}

/** Three depth layers (back / mid / front) that share phase-driven yaw. */
export function appendLissajous3DStack(
  builders: {back: SkPathBuilder; mid: SkPathBuilder; front: SkPathBuilder},
  opts: Omit<Lissajous3DLayerOpts, 'yawRad'> & {phaseDeg: number},
): void {
  'worklet';
  const phaseRad = (opts.phaseDeg * Math.PI) / 180;
  const stacks: Array<{target: SkPathBuilder; yawOff: number; scaleMul: number; phaseOff: number}> = [
    {target: builders.back, yawOff: -0.55, scaleMul: 0.68, phaseOff: -22},
    {target: builders.mid, yawOff: 0, scaleMul: 0.86, phaseOff: 0},
    {target: builders.front, yawOff: 0.55, scaleMul: 1, phaseOff: 22},
  ];
  for (const layer of stacks) {
    appendLissajous3DLoop(layer.target, {
      ...opts,
      phaseDeg: opts.phaseDeg + layer.phaseOff,
      scale: opts.scale * layer.scaleMul,
      yawRad: phaseRad + layer.yawOff,
    });
  }
}

/** @deprecated Prefer usePathValue + appendLissajousPath */
export function buildLissajousPath(opts: Parameters<typeof appendLissajousPath>[1]) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  appendLissajousPath(builder, opts);
  return builder.build();
}
