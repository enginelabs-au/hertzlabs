import {DEFAULT_BEAT_HZ} from '../../audio/paramMapping';
import type {MathPresetItem} from './MathModeGroupRow';

export type MathFormulaDisplay = {
  primary: string;
  secondary: string;
};

export const DEFAULT_MATH_FORMULA: MathFormulaDisplay = {
  primary: 'f_target = |f_L − f_R|',
  secondary: 'π · φ · √2 · f_target = (f_L + f_R) / 2',
};

const SOLFEGGIO_SYMBOLS: Record<string, string> = {
  'sol-396': 'S_UT',
  'sol-417': 'S_RE',
  'sol-528': 'S_MI',
  'sol-639': 'S_FA',
  'sol-741': 'S_SOL',
  'sol-852': 'S_LA',
};

const FIBONACCI_INDEX: Record<string, string> = {
  'fib-1': 'F₇',
  'fib-2': 'F₈',
  'fib-3': 'F₉',
  'fib-4': 'F₁₀',
};

const FIBONACCI_DELTA: Record<string, string> = {
  'fib-1': 'F₆ + F₅ = 8 + 5 → F₇',
  'fib-2': 'F₈ − F₇ = 21 − 13 = 8',
  'fib-3': 'F₉ − F₈ = 34 − 21 = 13',
  'fib-4': 'F₁₀ − F₉ = 55 − 34 = 21',
};

/** Educational formula strings keyed to the active Math Mode preset. */
export function getMathPresetFormula(
  preset: MathPresetItem | null,
): MathFormulaDisplay {
  if (preset == null) {
    return DEFAULT_MATH_FORMULA;
  }

  switch (preset.group) {
    case 'Schumann Resonances': {
      const harmonic = preset.id.split('-')[1] ?? '1';
      if (harmonic === '1') {
        return {
          primary: `f_1 = ${preset.beatHz} Hz`,
          secondary: 'f_0 = 7.83 Hz — primary Earth–ionosphere cavity mode',
        };
      }
      return {
        primary: `f_${harmonic} = ${preset.beatHz} Hz`,
        secondary: `f_n ≈ f_0 + (n − 1) · Δλ — Schumann eigenmode ${harmonic}`,
      };
    }

    case 'Alpha Focus':
      return {
        primary: 'f_α = 10.0 Hz',
        secondary: 'f_target = |f_L − f_R| — peak Alpha entrainment (8–12 Hz)',
      };

    case 'Golden Ratio (φ)': {
      const power = preset.id.replace('phi-', '');
      return {
        primary: `f = φ^${power} = ${preset.beatHz} Hz`,
        secondary: 'φ = (1 + √5) / 2 ≈ 1.618 — golden proportional interval',
      };
    }

    case 'Fibonacci':
      return {
        primary: `f = ${FIBONACCI_INDEX[preset.id] ?? 'F_n'} = ${preset.beatHz} Hz`,
        secondary: `${FIBONACCI_DELTA[preset.id] ?? 'F_n = F_{n−1} + F_{n−2}'} — natural delta sequence`,
      };

    case 'Solfeggio': {
      const symbol = SOLFEGGIO_SYMBOLS[preset.id] ?? 'S_n';
      return {
        primary: `f_carrier = ${preset.beatHz} Hz (${symbol})`,
        secondary: `Δf = |f_L − f_R| = ${DEFAULT_BEAT_HZ} Hz — ancient tuning + entrainment`,
      };
    }

    default:
      return DEFAULT_MATH_FORMULA;
  }
}
