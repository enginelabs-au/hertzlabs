import {describe, expect, it} from 'vitest';
import {evaluateMathFormula, PHI} from '../src/components/math/evaluateMathFormula';

const ctx = {
  f_L: 215,
  f_R: 225,
  f_beat: 10,
  f_c: 220,
};

describe('evaluateMathFormula', () => {
  it('computes |f_L - f_R| as beat differential', () => {
    const result = evaluateMathFormula('|f_L - f_R|', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hz).toBe(10);
    }
  });

  it('supports golden ratio constant', () => {
    const result = evaluateMathFormula('φ', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hz).toBeCloseTo(PHI, 5);
    }
  });

  it('supports sqrt and power', () => {
    const result = evaluateMathFormula('sqrt(9) ** 2', ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hz).toBe(9);
    }
  });

  it('rejects empty input', () => {
    expect(evaluateMathFormula('', ctx)).toEqual({ok: false, error: 'Enter a formula first.'});
  });
});
