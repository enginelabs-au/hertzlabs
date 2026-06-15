import type {BreathPatternId} from './patterns';
import {BREATH_PATTERNS, MAX_BREATH_DELTA_DB, MIN_BREATH_DELTA_DB} from './patterns';

export type BreathSegmentKind = 'inhale' | 'holdPeak' | 'exhale' | 'holdTrough';

type BreathSegment = {
  kind: BreathSegmentKind;
  durationSec: number;
};

const PATTERN_SEGMENTS: Record<BreathPatternId, BreathSegment[]> = {
  box: [
    {kind: 'inhale', durationSec: 4},
    {kind: 'holdPeak', durationSec: 4},
    {kind: 'exhale', durationSec: 4},
    {kind: 'holdTrough', durationSec: 4},
  ],
  '478': [
    {kind: 'inhale', durationSec: 4},
    {kind: 'holdPeak', durationSec: 7},
    {kind: 'exhale', durationSec: 8},
  ],
  resonant: [
    {kind: 'inhale', durationSec: 5.5},
    {kind: 'exhale', durationSec: 5.5},
  ],
};

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 0.5 - 0.5 * Math.cos(x * Math.PI);
}

function envelopeAt(kind: BreathSegmentKind, progress: number, deltaDb: number): number {
  const peak = dbToLinear(deltaDb * 0.5);
  const trough = dbToLinear(-deltaDb * 0.5);
  switch (kind) {
    case 'inhale':
      return trough + (peak - trough) * smooth01(progress);
    case 'holdPeak':
      return peak;
    case 'exhale':
      return peak + (trough - peak) * smooth01(progress);
    case 'holdTrough':
    default:
      return trough;
  }
}

/** Gain multiplier (≈1.0 center) for wall-clock time within a breath cycle. */
export function breathGainMultiplierAt(
  patternId: BreathPatternId,
  deltaDb: number,
  clockStartedAtMs: number,
  nowMs = Date.now(),
): number {
  const segments = PATTERN_SEGMENTS[patternId] ?? PATTERN_SEGMENTS.box;
  const cycleSec = BREATH_PATTERNS.find(p => p.id === patternId)?.cycleSec ?? 16;
  const clampedDelta = Math.max(MIN_BREATH_DELTA_DB, Math.min(MAX_BREATH_DELTA_DB, deltaDb));

  const elapsedSec = Math.max(0, (nowMs - clockStartedAtMs) / 1000);
  const inCycle = elapsedSec % cycleSec;

  let cursor = 0;
  for (const seg of segments) {
    const end = cursor + seg.durationSec;
    if (inCycle < end) {
      const progress = seg.durationSec > 0 ? (inCycle - cursor) / seg.durationSec : 1;
      return envelopeAt(seg.kind, progress, clampedDelta);
    }
    cursor = end;
  }

  return 1;
}

export function modulatedBreathGain(anchorGain: number, multiplier: number): number {
  return Math.max(0, Math.min(1, anchorGain * multiplier));
}
