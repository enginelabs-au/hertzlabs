import type {NoiseLayers} from '../state/types';
import {PEAK_CEILING_LINEAR, type NoiseType} from './paramMapping';

export type NoiseLayerId = keyof NoiseLayers;

export const NOISE_LAYER_META: Record<
  NoiseLayerId,
  {
    label: string;
    tagline: string;
    howItWorks: string;
    bestFor: string;
    descriptors: string[];
    accent: string;
  }
> = {
  white: {
    label: 'White',
    tagline: 'Equal power at every frequency',
    howItWorks:
      'Distributes equal power across every audible frequency. Because human ears are more sensitive to high frequencies, it can sometimes sound harsh.',
    bestFor: 'Masking sudden, disruptive sounds in very loud environments.',
    descriptors: ['Bright', 'Harsh', 'Static', 'Masking'],
    accent: '#E8E8F0',
  },
  pink: {
    label: 'Pink',
    tagline: 'Softer, balanced per octave',
    howItWorks:
      'Balances the frequencies by reducing power proportionally as frequency goes up, giving every octave equal energy. It accounts for human ear sensitivity, resulting in a softer sound than white noise.',
    bestFor:
      'Deep, restorative sleep, improving memory, and masking urban background noise.',
    descriptors: ['Soft', 'Steady', 'Natural', 'Sleep'],
    accent: '#F0A0C8',
  },
  brown: {
    label: 'Brown',
    tagline: 'Deep, low-frequency emphasis',
    howItWorks:
      'Emphasizes lower frequencies heavily while dropping the higher frequencies.',
    bestFor:
      'Deep focus, combating anxiety, and soothing tinnitus (ringing in the ears).',
    descriptors: ['Deep', 'Rumbling', 'Waves', 'Focus'],
    accent: '#C49A6C',
  },
};

export type NoiseLayerMeta = {
  id: NoiseLayerId;
  label: string;
  tag: string;
  descriptors: string[];
  deepDive: string;
  accent: string;
};

/** Catalog for accordion UI (matches engine selector pattern). */
export const NOISE_LAYER_CATALOG: NoiseLayerMeta[] = [
  {
    id: 'white',
    label: 'White Noise',
    tag: 'Equal spectrum',
    descriptors: NOISE_LAYER_META.white.descriptors,
    deepDive: `${NOISE_LAYER_META.white.howItWorks} Best for: ${NOISE_LAYER_META.white.bestFor}`,
    accent: NOISE_LAYER_META.white.accent,
  },
  {
    id: 'pink',
    label: 'Pink Noise',
    tag: 'Balanced per octave',
    descriptors: NOISE_LAYER_META.pink.descriptors,
    deepDive: `${NOISE_LAYER_META.pink.howItWorks} Best for: ${NOISE_LAYER_META.pink.bestFor}`,
    accent: NOISE_LAYER_META.pink.accent,
  },
  {
    id: 'brown',
    label: 'Brown Noise',
    tag: 'Low-frequency depth',
    descriptors: NOISE_LAYER_META.brown.descriptors,
    deepDive: `${NOISE_LAYER_META.brown.howItWorks} Best for: ${NOISE_LAYER_META.brown.bestFor}`,
    accent: NOISE_LAYER_META.brown.accent,
  },
];

/** Per-layer linear gain (0 when off). Master mix is 0–1 UI → full-scale ceiling. */
export function noiseLayerGains(layers: NoiseLayers, mixNorm: number): {
  white: number;
  pink: number;
  brown: number;
} {
  const active = (['white', 'pink', 'brown'] as const).filter(id => layers[id]);
  const master = Math.max(0, Math.min(1, mixNorm)) * PEAK_CEILING_LINEAR;
  if (active.length === 0 || master <= 0) {
    return {white: 0, pink: 0, brown: 0};
  }
  const per =
    active.length === 1 ? master * 0.95 : (master / Math.sqrt(active.length)) * 0.92;
  return {
    white: layers.white ? per : 0,
    pink: layers.pink ? per : 0,
    brown: layers.brown ? per : 0,
  };
}

export function anyNoiseActive(layers: NoiseLayers): boolean {
  return layers.white || layers.pink || layers.brown;
}

/** Map legacy preset noiseType into layer toggles. */
export function layersFromLegacyNoiseType(type: NoiseType): NoiseLayers {
  return {
    white: type === 'white',
    pink: type === 'pink',
    brown: type === 'brown',
  };
}

export function legacyNoiseTypeFromLayers(layers: NoiseLayers): NoiseType {
  const on = (['white', 'pink', 'brown'] as const).filter(id => layers[id]);
  if (on.length === 0) {
    return 'none';
  }
  if (on.length === 1) {
    return on[0];
  }
  return 'white';
}

/** Normalized 0–1 master noise amount (mapped to linear gain before native push). */
export const DEFAULT_NOISE_MIX = 0.72;
