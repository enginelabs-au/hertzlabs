import {
  beatHzToSliderNorm,
  sliderNormToBeatHz,
  type BeatSliderScale,
} from '../../audio/beatHzSlider';
import {clampNumber} from '../../audio/paramMapping';
import type {SubscriptionTier} from '../../state/types';

const TRAVEL_X = 0.4;
const TRAVEL_Y = 0.4;

export function beatPhaseToSourcePx(
  plotW: number,
  plotH: number,
  beatHz: number,
  phaseAngle: number,
  tier: SubscriptionTier,
  scale: BeatSliderScale = 'exponential',
): {cx: number; cy: number} {
  const norm = beatHzToSliderNorm(beatHz, tier, scale);
  const nx = (norm - 0.5) * 2;
  const ny = (phaseAngle / 360 - 0.5) * 2;
  return {
    cx: plotW * (0.5 + nx * TRAVEL_X),
    cy: plotH * (0.5 - ny * TRAVEL_Y),
  };
}

export function gainToSourceBoost(gain: number): number {
  return clampNumber(gain, 0.08, 1, 0.45) * 0.12;
}

export function sourcePxToAudioParams(
  cx: number,
  cy: number,
  plotW: number,
  plotH: number,
  tier: SubscriptionTier,
  axisLock: 'x' | 'y' | 'both',
  scale: BeatSliderScale = 'exponential',
): {beatHz?: number; phaseAngle?: number; gain?: number} {
  const nx = clampNumber((cx - plotW * 0.5) / (plotW * TRAVEL_X), -1, 1, 0);
  const ny = clampNumber(-(cy - plotH * 0.5) / (plotH * TRAVEL_Y), -1, 1, 0);
  const out: {beatHz?: number; phaseAngle?: number; gain?: number} = {};

  if (axisLock === 'x' || axisLock === 'both') {
    const norm = clampNumber((nx + 1) * 0.5, 0, 1, 0.5);
    out.beatHz = sliderNormToBeatHz(norm, tier, scale);
  }
  if (axisLock === 'y' || axisLock === 'both') {
    out.phaseAngle = clampNumber(((ny + 1) * 0.5) * 360, 0, 360, 0);
  }
  const dist = Math.min(1, Math.sqrt(nx * nx + ny * ny));
  out.gain = clampNumber(0.1 + dist * 0.82, 0.08, 1, 0.45);

  return out;
}

export function dominantAxis(dx: number, dy: number): 'x' | 'y' {
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}
