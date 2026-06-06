import {Skia} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import {scopeStereoHz} from '../../audio/channelFrequencies';
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
  /** Horizontal trace along the top — left ear Hz. */
  leftChannel: SkPath;
  /** Vertical trace along the left edge — right ear Hz. */
  rightChannel: SkPath;
  lissajousBack: SkPath;
  lissajousMid: SkPath;
  lissajousFront: SkPath;
};

function finite(n: number, fallback: number): number {
  'worklet';
  return Number.isFinite(n) ? n : fallback;
}

/** Wider trace window → slower edge scroll; leading sample still at `timeSec` (audio-aligned). */
export const HUB_TRACE_SPAN_MUL = 1.38;

/** Lissajous samples per layer — lower = less work per frame. */
export const HUB_LISSAJOU_POINTS = 48;

/** Cap oscilloscope trace steps for hub border waves. */
export const HUB_TRACE_MAX_STEPS = 48;

/** Build all hub scope paths (UI-thread safe via worklet callees). */
export function buildHubScopePaths(
  width: number,
  height: number,
  timeSec: number,
  audio: HubAudioParams,
): HubScopePaths {
  'worklet';
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

  // Exact previous-commit scope, clamped to [0.5, 500] Hz so nothing outside the
  // normal band is ever drawn (Experimental pitches hold the boundary pattern).
  const {leftHz, rightHz} = scopeStereoHz(carrierHz, beatHz, leftDriftHz, rightDriftHz);
  const size = Math.min(w, h);
  const cx = w * 0.48;
  const cy = h * 0.5;
  const lissScale = size * 0.44;
  const borderAmp = size * 0.085;
  const topLen = Math.max(24, w - 12);
  const leftLen = Math.max(24, h - 16);
  const phaseRad = (phaseAngle * Math.PI) / 180;

  const leftChannelB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(leftChannelB, {
    length: topLen,
    center: size * 0.055,
    amplitude: borderAmp,
    hz: leftHz,
    timeSec: t,
    orientation: 'horizontal',
    gain,
    traceSpanMul: HUB_TRACE_SPAN_MUL,
    maxSteps: HUB_TRACE_MAX_STEPS,
  });

  const rightChannelB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(rightChannelB, {
    length: leftLen,
    center: size * 0.05,
    amplitude: borderAmp * 0.92,
    hz: rightHz,
    timeSec: t,
    orientation: 'vertical',
    phaseRad,
    gain,
    traceSpanMul: HUB_TRACE_SPAN_MUL,
    maxSteps: HUB_TRACE_MAX_STEPS,
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
      pointCount: HUB_LISSAJOU_POINTS,
    },
  );

  return {
    leftChannel: leftChannelB.build(),
    rightChannel: rightChannelB.build(),
    lissajousBack: backB.build(),
    lissajousMid: midB.build(),
    lissajousFront: frontB.build(),
  };
}
