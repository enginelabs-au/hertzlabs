export type BreathPatternId = 'box' | '478' | 'resonant';

export type BreathPatternMeta = {
  id: BreathPatternId;
  nativeId: number;
  label: string;
  subtitle: string;
  cycleSec: number;
};

export const BREATH_PATTERNS: BreathPatternMeta[] = [
  {
    id: 'box',
    nativeId: 0,
    label: 'Box Breathing',
    subtitle: '4s in · 4s hold · 4s out · 4s hold',
    cycleSec: 16,
  },
  {
    id: '478',
    nativeId: 1,
    label: '4-7-8 Sleep',
    subtitle: '4s in · 7s hold · 8s out',
    cycleSec: 19,
  },
  {
    id: 'resonant',
    nativeId: 2,
    label: 'Resonant Pacing',
    subtitle: '5.5s in · 5.5s out',
    cycleSec: 11,
  },
];

export function breathPatternToNativeId(id: BreathPatternId): number {
  return BREATH_PATTERNS.find(p => p.id === id)?.nativeId ?? 0;
}

export const DEFAULT_BREATH_DELTA_DB = 4.5;
export const MIN_BREATH_DELTA_DB = 3;
export const MAX_BREATH_DELTA_DB = 6;
