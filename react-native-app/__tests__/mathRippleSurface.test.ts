import {describe, expect, it} from 'vitest';
import {
  binauralSampleJs,
  binauralSurfaceHeight,
  sanitizeAudioSurfaceParams,
} from '../src/audio/binauralSurfaceMath';
import {channelFrequencies} from '../src/audio/channelFrequencies';
import {
  colorForHeight,
  pondRippleHeight,
  radialKFromBeatHz,
} from '../src/components/math/mathRippleSurface';

const baseAudio = {
  carrierHz: 220,
  beatHz: 10,
  phaseAngle: 0,
  gain: 0.5,
  balance: 0,
  leftDriftHz: 0,
  rightDriftHz: 0,
};

describe('pondRippleHeight', () => {
  it('is radially symmetric at a fixed time', () => {
    const a = pondRippleHeight(2, 0, 1, baseAudio);
    const b = pondRippleHeight(0, 2, 1, baseAudio);
    expect(a).toBeCloseTo(b, 4);
  });

  it('animates over time', () => {
    const a = pondRippleHeight(1.5, 0, 0, baseAudio);
    const b = pondRippleHeight(1.5, 0, 0.25, baseAudio);
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('beat Hz changes ring density', () => {
    expect(radialKFromBeatHz(20)).toBeGreaterThan(radialKFromBeatHz(4));
  });
});

describe('binauralSurfaceHeight', () => {
  it('matches binauralSample at centre', () => {
    const t = 1.5;
    const {leftHz, rightHz} = channelFrequencies(220, 10, 0, 0);
    const {left, right} = binauralSampleJs(t, leftHz, rightHz, 0, 0.5, 0);
    const z = binauralSurfaceHeight(0, 0, t, baseAudio);
    expect(z).toBeCloseTo((left + right) / (2 * 0.5011872336), 4);
  });

  it('sanitize clamps drift', () => {
    const s = sanitizeAudioSurfaceParams({...baseAudio, leftDriftHz: 99});
    expect(s.leftDriftHz).toBe(12);
  });
});

describe('colorForHeight', () => {
  it('returns rgb strings', () => {
    expect(colorForHeight(-1)).toMatch(/^rgb\(/);
    expect(colorForHeight(1)).toMatch(/^rgb\(/);
  });
});
