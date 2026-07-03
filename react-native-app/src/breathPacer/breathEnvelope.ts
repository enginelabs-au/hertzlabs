import type {BreathPatternId} from './patterns';
import {BREATH_PATTERNS, MAX_BREATH_DELTA_DB, MIN_BREATH_DELTA_DB} from './patterns';

export type BreathSegmentKind = 'inhale' | 'holdPeak' | 'exhale' | 'holdTrough';

type BreathSegment = {
  kind: BreathSegmentKind;
  durationSec: number;
  /** Visual-only label override (e.g. alternate nostril side). */
  visualLabel?: string;
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
  wimhof: [
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 2},
    {kind: 'inhale', durationSec: 2},
    {kind: 'exhale', durationSec: 60, visualLabel: 'Exhale · hold empty'},
    {kind: 'inhale', durationSec: 4, visualLabel: 'Recovery breath'},
    {kind: 'holdPeak', durationSec: 15, visualLabel: 'Hold full'},
  ],
  alternate: [
    {kind: 'inhale', durationSec: 4, visualLabel: 'Inhale · left'},
    {kind: 'holdPeak', durationSec: 4, visualLabel: 'Hold · switch'},
    {kind: 'exhale', durationSec: 4, visualLabel: 'Exhale · right'},
    {kind: 'holdTrough', durationSec: 4, visualLabel: 'Hold · switch'},
  ],
};

export type BreathPhaseSnapshot = {
  kind: BreathSegmentKind;
  progress: number;
  label: string;
  /** 0.35–1.0 visual scale for ring expansion. */
  visualScale: number;
  cycleSec: number;
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

function defaultLabel(kind: BreathSegmentKind): string {
  switch (kind) {
    case 'inhale':
      return 'Inhale';
    case 'holdPeak':
      return 'Hold';
    case 'exhale':
      return 'Exhale';
    case 'holdTrough':
    default:
      return 'Hold empty';
  }
}

function visualScaleFor(kind: BreathSegmentKind, progress: number): number {
  const min = 0.35;
  const max = 1;
  switch (kind) {
    case 'inhale':
      return min + (max - min) * smooth01(progress);
    case 'holdPeak':
      return max;
    case 'exhale':
      return max - (max - min) * smooth01(progress);
    case 'holdTrough':
    default:
      return min;
  }
}

function locateSegment(
  patternId: BreathPatternId,
  clockStartedAtMs: number,
  nowMs: number,
): {segment: BreathSegment; progress: number; cycleSec: number} {
  const segments = PATTERN_SEGMENTS[patternId] ?? PATTERN_SEGMENTS.box;
  const cycleSec = BREATH_PATTERNS.find(p => p.id === patternId)?.cycleSec ?? 16;
  const elapsedSec = Math.max(0, (nowMs - clockStartedAtMs) / 1000);
  const inCycle = elapsedSec % cycleSec;

  let cursor = 0;
  for (const seg of segments) {
    const end = cursor + seg.durationSec;
    if (inCycle < end) {
      const progress = seg.durationSec > 0 ? (inCycle - cursor) / seg.durationSec : 1;
      return {segment: seg, progress, cycleSec};
    }
    cursor = end;
  }

  const fallback = segments[0];
  return {segment: fallback, progress: 0, cycleSec};
}

/** Current breath phase for UI visualiser (inhale / hold / exhale). */
export function breathPhaseAt(
  patternId: BreathPatternId,
  clockStartedAtMs: number | null,
  nowMs = Date.now(),
): BreathPhaseSnapshot | null {
  if (clockStartedAtMs == null) {
    return null;
  }
  const {segment, progress, cycleSec} = locateSegment(patternId, clockStartedAtMs, nowMs);
  return {
    kind: segment.kind,
    progress,
    label: segment.visualLabel ?? defaultLabel(segment.kind),
    visualScale: visualScaleFor(segment.kind, progress),
    cycleSec,
  };
}

/** Gain multiplier (≈1.0 center) for wall-clock time within a breath cycle. */
export function breathGainMultiplierAt(
  patternId: BreathPatternId,
  deltaDb: number,
  clockStartedAtMs: number,
  nowMs = Date.now(),
): number {
  const {segment, progress} = locateSegment(patternId, clockStartedAtMs, nowMs);
  const clampedDelta = Math.max(MIN_BREATH_DELTA_DB, Math.min(MAX_BREATH_DELTA_DB, deltaDb));
  return envelopeAt(segment.kind, progress, clampedDelta);
}

export function modulatedBreathGain(anchorGain: number, multiplier: number): number {
  return Math.max(0, Math.min(1, anchorGain * multiplier));
}
