import {Skia} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import {
  appendLissajousPath,
  appendOscilloscopeTrace,
  stereoHzFromBinaural,
} from '../../audio/oscilloscopeMath';

export type HubAudioParams = {
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
  gain: number;
  balance: number;
};

export type HubScopePaths = {
  top: SkPath;
  left: SkPath;
  lissajous: SkPath;
  lissajousGlow: SkPath;
};

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Build all hub scope paths on the JS thread (no Reanimated mappers). */
export function buildHubScopePaths(
  width: number,
  height: number,
  timeSec: number,
  audio: HubAudioParams,
): HubScopePaths {
  const w = Math.max(64, width);
  const h = Math.max(64, height);
  const carrierHz = finite(audio.carrierHz, 200);
  const beatHz = finite(audio.beatHz, 10);
  const phaseAngle = finite(audio.phaseAngle, 0);
  const gain = finite(audio.gain, 0.45);
  const balance = finite(audio.balance, 0);
  const t = finite(timeSec, 0);

  const {leftHz, rightHz} = stereoHzFromBinaural(carrierHz, beatHz);
  const cx = w * 0.52;
  const cy = h * 0.48;
  const lissScale = Math.min(w, h) * 0.34;
  const topLen = Math.max(24, w - 20);
  const leftLen = Math.max(24, h - 36);
  const phaseRad = (phaseAngle * Math.PI) / 180;

  const topB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(topB, {
    length: topLen,
    center: 12,
    amplitude: 9,
    hz: leftHz,
    timeSec: t,
    orientation: 'horizontal',
    gain,
  });

  const leftB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(leftB, {
    length: leftLen,
    center: 11,
    amplitude: 8,
    hz: rightHz,
    timeSec: t,
    orientation: 'vertical',
    phaseRad,
    gain,
  });

  const lissaB = Skia.PathBuilder.Make();
  appendLissajousPath(lissaB, {
    cx,
    cy,
    scale: lissScale,
    leftHz,
    rightHz,
    phaseDeg: phaseAngle,
    gain,
    balance,
    timeSec: t,
    pointCount: 120,
  });

  const glowB = Skia.PathBuilder.Make();
  appendLissajousPath(glowB, {
    cx,
    cy,
    scale: lissScale * 0.92,
    leftHz,
    rightHz,
    phaseDeg: phaseAngle + 12,
    gain: gain * 0.75,
    balance,
    timeSec: t + 0.002,
    pointCount: 100,
  });

  return {
    top: topB.build(),
    left: leftB.build(),
    lissajous: lissaB.build(),
    lissajousGlow: glowB.build(),
  };
}
