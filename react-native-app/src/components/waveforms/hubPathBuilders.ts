import {Skia} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import {channelFrequencies} from '../../audio/channelFrequencies';
import {
  appendLissajous3DStack,
  appendOscilloscopeTrace,
} from '../../audio/oscilloscopeMath';

export type HubAudioParams = {
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
  gain: number;
  balance: number;
  leftDriftHz: number;
  rightDriftHz: number;
};

export type HubScopePaths = {
  top: SkPath;
  left: SkPath;
  lissajousBack: SkPath;
  lissajousMid: SkPath;
  lissajousFront: SkPath;
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
  const leftDriftHz = finite(audio.leftDriftHz, 0);
  const rightDriftHz = finite(audio.rightDriftHz, 0);
  const t = finite(timeSec, 0);

  const {leftHz, rightHz} = channelFrequencies(carrierHz, beatHz, leftDriftHz, rightDriftHz);
  const size = Math.min(w, h);
  const cx = w * 0.48;
  const cy = h * 0.5;
  const lissScale = size * 0.44;
  const borderAmp = size * 0.085;
  const topLen = Math.max(24, w - 12);
  const leftLen = Math.max(24, h - 16);
  const phaseRad = (phaseAngle * Math.PI) / 180;

  const topB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(topB, {
    length: topLen,
    center: size * 0.055,
    amplitude: borderAmp,
    hz: leftHz,
    timeSec: t,
    orientation: 'horizontal',
    gain,
  });

  const leftB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(leftB, {
    length: leftLen,
    center: size * 0.05,
    amplitude: borderAmp * 0.92,
    hz: rightHz,
    timeSec: t,
    orientation: 'vertical',
    phaseRad,
    gain,
  });

  const backB = Skia.PathBuilder.Make();
  const midB = Skia.PathBuilder.Make();
  const frontB = Skia.PathBuilder.Make();
  appendLissajous3DStack(
    {back: backB, mid: midB, front: frontB},
    {
      cx,
      cy,
      scale: lissScale,
      leftHz,
      rightHz,
      phaseDeg: phaseAngle,
      gain,
      balance,
      timeSec: t,
      pointCount: 130,
    },
  );

  return {
    top: topB.build(),
    left: leftB.build(),
    lissajousBack: backB.build(),
    lissajousMid: midB.build(),
    lissajousFront: frontB.build(),
  };
}
