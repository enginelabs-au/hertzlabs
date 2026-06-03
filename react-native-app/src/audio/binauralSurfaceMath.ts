import {channelFrequencies, clampDriftHz} from './channelFrequencies';

const TWO_PI = 2 * Math.PI;
const MAX_AMP = 0.5011872336;

export type AudioSurfaceParams = {
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
  gain: number;
  balance: number;
  leftDriftHz: number;
  rightDriftHz: number;
};

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function sanitizeAudioSurfaceParams(p: AudioSurfaceParams): AudioSurfaceParams {
  return {
    carrierHz: finite(p.carrierHz, 220),
    beatHz: finite(p.beatHz, 10),
    phaseAngle: finite(p.phaseAngle, 0),
    gain: Math.min(1, Math.max(0, finite(p.gain, 0.45))),
    balance: Math.min(1, Math.max(-1, finite(p.balance, 0))),
    leftDriftHz: clampDriftHz(p.leftDriftHz),
    rightDriftHz: clampDriftHz(p.rightDriftHz),
  };
}

/** Same law as `oscilloscopeMath.binauralSample` (JS thread, no Skia). */
export function binauralSampleJs(
  tSec: number,
  leftHz: number,
  rightHz: number,
  phaseDeg: number,
  gain: number,
  balance: number,
): {left: number; right: number} {
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

export function binauralSurfaceHeight(
  u: number,
  v: number,
  timeSec: number,
  audio: AudioSurfaceParams,
): number {
  const a = sanitizeAudioSurfaceParams(audio);
  const {leftHz, rightHz} = channelFrequencies(
    a.carrierHz,
    a.beatHz,
    a.leftDriftHz,
    a.rightDriftHz,
  );
  const beat = Math.max(0.05, a.beatHz);
  const period = 1 / beat;
  const tL = timeSec + u * period * 0.5;
  const tR = timeSec + v * period * 0.5;
  const {left, right} = binauralSampleJs(tL, leftHz, rightHz, a.phaseAngle, a.gain, a.balance);
  return (left + right) / (2 * MAX_AMP);
}
