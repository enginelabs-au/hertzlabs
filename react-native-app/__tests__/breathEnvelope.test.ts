import {describe, expect, it} from 'vitest';
import {breathGainMultiplierAt, modulatedBreathGain} from '../src/breathPacer/breathEnvelope';

describe('breath envelope', () => {
  const t0 = 1_000_000;

  it('returns trough at cycle start for box pattern', () => {
    const mult = breathGainMultiplierAt('box', 4.5, t0, t0);
    expect(mult).toBeLessThan(1);
    expect(mult).toBeGreaterThan(0.5);
  });

  it('peaks mid-inhale for box pattern', () => {
    const mult = breathGainMultiplierAt('box', 4.5, t0, t0 + 2000);
    expect(mult).toBeGreaterThan(1);
  });

  it('modulates anchor gain within 0..1', () => {
    expect(modulatedBreathGain(0.5, 1.2)).toBe(0.6);
    expect(modulatedBreathGain(0.9, 2)).toBe(1);
    expect(modulatedBreathGain(0.1, 0)).toBe(0);
  });

  it('cycles every 16s for box', () => {
    const a = breathGainMultiplierAt('box', 4.5, t0, t0 + 1000);
    const b = breathGainMultiplierAt('box', 4.5, t0, t0 + 16_000 + 1000);
    expect(a).toBeCloseTo(b, 5);
  });
});
