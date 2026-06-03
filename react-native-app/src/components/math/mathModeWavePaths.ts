import {Skia} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import {channelFrequencies} from '../../audio/channelFrequencies';
import {appendOscilloscopeTrace, binauralSample} from '../../audio/oscilloscopeMath';
import type {HubAudioParams} from '../waveforms/hubPathBuilders';

export type MathWaveStripPaths = {
  left: SkPath;
  right: SkPath;
  mix: SkPath;
};

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** L/R + binaural sum traces — same DSP law as the audible engine (hub oscilloscope). */
export function buildMathWaveStripPaths(
  width: number,
  height: number,
  timeSec: number,
  audio: HubAudioParams,
): MathWaveStripPaths {
  const w = Math.max(8, width);
  const h = Math.max(8, height);
  const carrierHz = finite(audio.carrierHz, 200);
  const beatHz = finite(audio.beatHz, 10);
  const phaseAngle = finite(audio.phaseAngle, 0);
  const gain = finite(audio.gain, 0.45);
  const balance = finite(audio.balance, 0);
  const leftDriftHz = finite(audio.leftDriftHz, 0);
  const rightDriftHz = finite(audio.rightDriftHz, 0);
  const t = finite(timeSec, 0);

  const {leftHz, rightHz} = channelFrequencies(carrierHz, beatHz, leftDriftHz, rightDriftHz);
  const phaseRad = (phaseAngle * Math.PI) / 180;
  const amp = h * 0.22;
  const cyL = h * 0.28;
  const cyR = h * 0.52;
  const cyM = h * 0.76;

  const traceSteps = Math.min(80, Math.max(48, Math.floor(w / 5)));

  const leftB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(leftB, {
    length: w,
    center: cyL,
    amplitude: amp,
    hz: leftHz,
    timeSec: t,
    orientation: 'horizontal',
    gain,
    maxSteps: traceSteps,
  });

  const rightB = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(rightB, {
    length: w,
    center: cyR,
    amplitude: amp * 0.92,
    hz: rightHz,
    timeSec: t,
    orientation: 'horizontal',
    phaseRad,
    gain,
    maxSteps: traceSteps,
  });

  const mixB = Skia.PathBuilder.Make();
  const steps = Math.min(96, Math.max(48, Math.floor(w / 4)));
  const windowSec = Math.max(1 / Math.max(beatHz, 0.05), 0.02);
  for (let i = 0; i <= steps; i++) {
    const xNorm = i / steps;
    const sampleT = t - windowSec * (1 - xNorm);
    const {left, right} = binauralSample(sampleT, leftHz, rightHz, phaseAngle, gain, balance);
    const y = cyM + (left + right) * amp * 0.85;
    const x = xNorm * w;
    if (i === 0) {
      mixB.moveTo(x, y);
    } else {
      mixB.lineTo(x, y);
    }
  }

  return {
    left: leftB.build(),
    right: rightB.build(),
    mix: mixB.build(),
  };
}
