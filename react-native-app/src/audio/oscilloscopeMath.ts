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
  } = opts;
  const steps = Math.max(120, Math.floor(length / 2));
  const windowSec = Math.max(1 / Math.max(hz, 0.05), 0.02);
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

/** @deprecated Prefer usePathValue + appendLissajousPath */
export function buildLissajousPath(opts: Parameters<typeof appendLissajousPath>[1]) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  appendLissajousPath(builder, opts);
  return builder.build();
}
