import {channelFrequencies} from '../../audio/channelFrequencies';
import {binauralSample} from '../../audio/oscilloscopeMath';
import {dopplerGradientColor} from './dopplerFieldPalette';

export type DopplerFieldParams = {
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
  gain: number;
  balance: number;
  leftDriftHz: number;
  rightDriftHz: number;
  timeSec: number;
  /** Emitter position in plot pixels. */
  sourceX: number;
  sourceY: number;
};

export type DopplerRing = {
  points: {x: number; y: number}[];
  color: string;
  strokeWidth: number;
};

const TWO_PI = Math.PI * 2;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function dopplerBeta(params: DopplerFieldParams): number {
  const {leftHz, rightHz} = channelFrequencies(
    params.carrierHz,
    params.beatHz,
    params.leftDriftHz,
    params.rightDriftHz,
  );
  const asym = (rightHz - leftHz) / Math.max(params.carrierHz * 2, 40);
  return clamp(params.balance * 0.36 + asym, -0.44, 0.44);
}

export function buildDopplerRings(
  width: number,
  height: number,
  params: DopplerFieldParams,
  ringCount = 22,
  stepsPerRing = 48,
): DopplerRing[] {
  const w = Math.max(64, width);
  const h = Math.max(64, height);
  const cx = params.sourceX;
  const cy = params.sourceY;
  const maxR = Math.min(w, h) * 0.48;
  const beta = dopplerBeta(params);
  const phaseRad = (params.phaseAngle * Math.PI) / 180;
  const beat = Math.max(0.05, params.beatHz);
  const carrier = Math.max(20, params.carrierHz);
  const {leftHz, rightHz} = channelFrequencies(
    params.carrierHz,
    params.beatHz,
    params.leftDriftHz,
    params.rightDriftHz,
  );

  const mix = binauralSample(params.timeSec, leftHz, rightHz, params.phaseAngle, params.gain, params.balance);
  const beatPulse = Math.sin(params.timeSec * beat * TWO_PI);
  const fineness = clamp(Math.sqrt(beat) * 0.2 + carrier / 850, 0.1, 0.5);
  const scroll = (params.timeSec * beat * 0.22) % 1;
  const ySquash = 0.9;
  const ampBoost = 1 + params.gain * 0.35 + Math.abs(mix.left + mix.right) * 0.28;

  const rings: DopplerRing[] = [];

  for (let ri = 0; ri < ringCount; ri++) {
    const radialT = (ri / ringCount + scroll) % 1;
    const baseR = radialT * maxR;
    if (baseR < 2) {
      continue;
    }

    const ringSample = binauralSample(
      params.timeSec - radialT * 0.04,
      leftHz,
      rightHz,
      params.phaseAngle,
      params.gain,
      params.balance,
    );
    const audioWave = (ringSample.left + ringSample.right) * 0.5;

    const pts: {x: number; y: number}[] = [];
    for (let i = 0; i <= stepsPerRing; i++) {
      const theta = (i / stepsPerRing) * TWO_PI;
      const stretch = 1 / (1 + beta * Math.cos(theta - phaseRad));
      const wobble =
        1 +
        audioWave * 0.18 * Math.sin(theta * 3 + params.timeSec * leftHz * 0.015) +
        beatPulse * 0.06;
      const r = baseR * stretch * ampBoost * wobble * (1 + fineness * 0.3);
      pts.push({
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta) * ySquash,
      });
    }

    const color = dopplerGradientColor(
      radialT,
      params.timeSec,
      beat,
      params.phaseAngle,
      audioWave,
      0.55 + params.gain * 0.28,
    );

    rings.push({
      points: pts,
      color,
      strokeWidth: 1.1 + radialT * 0.45 + Math.abs(audioWave) * 0.35,
    });
  }

  return rings;
}

export type DopplerGridLines = {
  vertical: {x1: number; y1: number; x2: number; y2: number}[];
  horizontal: {x1: number; y1: number; x2: number; y2: number}[];
};

export function buildDopplerGrid(width: number, height: number, divisions = 10): DopplerGridLines {
  const padX = width * 0.06;
  const padY = height * 0.08;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const vertical: DopplerGridLines['vertical'] = [];
  const horizontal: DopplerGridLines['horizontal'] = [];

  for (let i = 0; i <= divisions; i++) {
    const x = padX + (i / divisions) * innerW;
    vertical.push({x1: x, y1: padY, x2: x, y2: padY + innerH});
    const y = padY + (i / divisions) * innerH;
    horizontal.push({x1: padX, y1: y, x2: padX + innerW, y2: y});
  }

  return {vertical, horizontal};
}
