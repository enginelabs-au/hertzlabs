export type BreathPatternId = 'box' | '478' | 'resonant' | 'wimhof' | 'alternate';

export type BreathPatternMeta = {
  id: BreathPatternId;
  nativeId: number;
  label: string;
  subtitle: string;
  cycleSec: number;
  /** Show safety disclaimer when selected (intense patterns). */
  safetyNote?: string;
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
    subtitle: '5.5s in · 5.5s out (~5.5 breaths/min)',
    cycleSec: 11,
  },
  {
    id: 'wimhof',
    nativeId: 3,
    label: 'Energising Cycles',
    subtitle: '30 deep breaths · exhale hold · recovery breath',
    cycleSec: 90,
    safetyNote:
      'Intense breathwork — not medical treatment. Stop if dizzy or unwell; never use in water or while driving.',
  },
  {
    id: 'alternate',
    nativeId: 4,
    label: 'Alternate Nostril (visual)',
    subtitle: '4s in · 4s hold · 4s out — left/right cue only',
    cycleSec: 16,
  },
];

export function breathPatternToNativeId(id: BreathPatternId): number {
  return BREATH_PATTERNS.find(p => p.id === id)?.nativeId ?? 0;
}

export const DEFAULT_BREATH_DELTA_DB = 4.5;
export const MIN_BREATH_DELTA_DB = 3;
export const MAX_BREATH_DELTA_DB = 6;

export function breathPatternMeta(id: BreathPatternId): BreathPatternMeta {
  return BREATH_PATTERNS.find(p => p.id === id) ?? BREATH_PATTERNS[0];
}
