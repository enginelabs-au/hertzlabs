import {describe, expect, it, vi} from 'vitest';

vi.mock('@shopify/react-native-skia', () => {
  const makeBuilder = () => {
    let points = 0;
    return {
      moveTo: () => {
        points += 1;
      },
      lineTo: () => {
        points += 1;
      },
      build: () => ({countPoints: () => points}),
    };
  };
  return {
    Skia: {PathBuilder: {Make: makeBuilder}},
  };
});

import {buildMathWaveStripPaths} from '../src/components/math/mathModeWavePaths';

describe('buildMathWaveStripPaths', () => {
  it('builds three non-empty paths from binaural params', () => {
    const paths = buildMathWaveStripPaths(320, 80, 1.5, {
      carrierHz: 200,
      beatHz: 10,
      phaseAngle: 30,
      gain: 0.5,
      balance: 0,
      leftDriftHz: 0,
      rightDriftHz: 0,
    });
    expect(paths.left.countPoints()).toBeGreaterThan(2);
    expect(paths.right.countPoints()).toBeGreaterThan(2);
    expect(paths.mix.countPoints()).toBeGreaterThan(2);
  });
});
