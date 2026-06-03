import {Skia} from '@shopify/react-native-skia';
import type {SkPathBuilder} from '@shopify/react-native-skia';

export type WavePathOpts = {
  length: number;
  amplitude: number;
  cycles: number;
  phase: number;
  /** 0 = horizontal along length, 1 = vertical along length */
  orientation: 'horizontal' | 'vertical';
  center: number;
};

/** Append a sine wave into a PathBuilder (UI thread / usePathValue). */
export function appendRadiantWavePath(builder: SkPathBuilder, opts: WavePathOpts): void {
  'worklet';
  const {length, amplitude, cycles, phase, orientation, center} = opts;
  const steps = Math.max(80, Math.floor(length / 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * cycles + phase;
    const wobble = Math.sin(angle) * amplitude;
    if (orientation === 'horizontal') {
      const x = t * length;
      const y = center + wobble;
      if (i === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    } else {
      const y = t * length;
      const x = center + wobble;
      if (i === 0) {
        builder.moveTo(x, y);
      } else {
        builder.lineTo(x, y);
      }
    }
  }
}

function buildRadiantWavePathImpl(opts: WavePathOpts) {
  const builder = Skia.PathBuilder.Make();
  appendRadiantWavePath(builder, opts);
  return builder.build();
}

/** @deprecated Prefer usePathValue + appendRadiantWavePath */
export function buildRadiantWavePath(opts: WavePathOpts) {
  'worklet';
  return buildRadiantWavePathImpl(opts);
}

/** JS thread — static Skia canvases */
export function buildRadiantWavePathJs(opts: WavePathOpts) {
  return buildRadiantWavePathImpl(opts);
}
