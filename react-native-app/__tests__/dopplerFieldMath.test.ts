import {describe, expect, it, vi} from 'vitest';

vi.mock('@shopify/react-native-skia', () => ({
  Skia: {PathBuilder: {Make: () => ({moveTo: () => {}, lineTo: () => {}, close: () => {}, build: () => ({})})}},
}));

import {buildDopplerRings, dopplerBeta} from '../src/components/background/dopplerFieldMath';
import {dopplerGradientColor} from '../src/components/background/dopplerFieldPalette';
import {beatPhaseToSourcePx, dominantAxis} from '../src/components/background/dopplerSourceMapping';

const base = {
  carrierHz: 220,
  beatHz: 10,
  phaseAngle: 90,
  gain: 0.5,
  balance: 0,
  leftDriftHz: 0,
  rightDriftHz: 0,
  timeSec: 0,
  sourceX: 150,
  sourceY: 150,
};

describe('dopplerFieldMath', () => {
  it('beta shifts with balance', () => {
    const l = dopplerBeta({...base, balance: -0.5});
    const r = dopplerBeta({...base, balance: 0.5});
    expect(l).toBeLessThan(r);
  });

  it('rings animate and carry colour', () => {
    const a = buildDopplerRings(300, 200, base, 10, 32);
    const b = buildDopplerRings(300, 200, {...base, timeSec: 0.35}, 10, 32);
    expect(a.length).toBeGreaterThan(2);
    expect(a[0].color).toMatch(/^rgba\(/);
    expect(a[2].points[0].x).not.toBeCloseTo(b[2].points[0].x, 0);
  });

  it('gradient colour waves with time', () => {
    const a = dopplerGradientColor(0.3, 0, 10, 0, 0);
    const b = dopplerGradientColor(0.3, 0.5, 10, 0, 0);
    expect(a).not.toEqual(b);
  });
});

describe('dopplerSourceMapping', () => {
  it('maps beat/phase to pixels', () => {
    const p = beatPhaseToSourcePx(300, 200, 10, 180, 'free');
    expect(p.cx).toBeGreaterThan(100);
    expect(p.cy).toBeLessThan(120);
  });

  it('picks dominant drag axis', () => {
    expect(dominantAxis(10, 2)).toBe('x');
    expect(dominantAxis(1, 8)).toBe('y');
  });
});
