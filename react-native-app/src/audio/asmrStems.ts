import {PEAK_CEILING_LINEAR} from './paramMapping';

export type AsmrStemId = 'rain' | 'room' | 'brush' | 'tap';

export type AsmrStemMix = Record<AsmrStemId, number>;

export const DEFAULT_ASMR_STEM_MIX: AsmrStemMix = {
  rain: 0,
  room: 0,
  brush: 0,
  tap: 0,
};

export type AsmrStemMeta = {
  id: AsmrStemId;
  label: string;
  tag: string;
  hint: string;
  accent: string;
};

/** Procedural ASMR palette — each stem maps to weighted noise colours. */
export const ASMR_STEM_CATALOG: AsmrStemMeta[] = [
  {
    id: 'rain',
    label: 'Soft Rain',
    tag: 'Pink + brown blend',
    hint: 'Gentle shower texture under the tone',
    accent: '#7EC8E3',
  },
  {
    id: 'room',
    label: 'Room Tone',
    tag: 'Warm brown bed',
    hint: 'Low hum — cozy ambience',
    accent: '#C4A882',
  },
  {
    id: 'brush',
    label: 'Brush / Fabric',
    tag: 'Soft pink shimmer',
    hint: 'Light tactile rustle',
    accent: '#E8B4D4',
  },
  {
    id: 'tap',
    label: 'Gentle Tap',
    tag: 'Bright white spark',
    hint: 'Very subtle transient sparkle',
    accent: '#F0F0FA',
  },
];

const STEM_COLOUR: Record<AsmrStemId, {white: number; pink: number; brown: number}> = {
  rain: {white: 0.05, pink: 0.55, brown: 0.4},
  room: {white: 0.02, pink: 0.18, brown: 0.8},
  brush: {white: 0.15, pink: 0.65, brown: 0.2},
  tap: {white: 0.35, pink: 0.25, brown: 0.05},
};

export function clampStemMix(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/** Combine ambient noise layer + ASMR stem sliders into native white/pink/brown gains. */
export function combinedNoiseGains(input: {
  ambientLayers: {white: boolean; pink: boolean; brown: boolean};
  ambientMix: number;
  asmrEnabled: boolean;
  asmrMix: AsmrStemMix;
}): {white: number; pink: number; brown: number} {
  const ceiling = PEAK_CEILING_LINEAR * 0.95;
  let white = 0;
  let pink = 0;
  let brown = 0;

  const ambientMaster = Math.max(0, Math.min(1, input.ambientMix)) * ceiling;
  if (input.ambientLayers.white) {
    white += ambientMaster;
  }
  if (input.ambientLayers.pink) {
    pink += ambientMaster;
  }
  if (input.ambientLayers.brown) {
    brown += ambientMaster;
  }

  if (input.asmrEnabled) {
    for (const stem of ASMR_STEM_CATALOG) {
      const mix = clampStemMix(input.asmrMix[stem.id]);
      if (mix <= 0) {
        continue;
      }
      const w = STEM_COLOUR[stem.id];
      const stemGain = mix * ceiling * 0.55;
      white += w.white * stemGain;
      pink += w.pink * stemGain;
      brown += w.brown * stemGain;
    }
  }

  const max = Math.max(white, pink, brown, 1e-9);
  if (max > ceiling) {
    const scale = ceiling / max;
    white *= scale;
    pink *= scale;
    brown *= scale;
  }

  return {white, pink, brown};
}
