import {describe, expect, it} from 'vitest';
import {
  MIN_BEAT_HZ,
  MAX_BEAT_HZ,
  PEAK_CEILING_LINEAR,
  MIN_RAMP_MS,
  MAX_RAMP_MS,
  DEFAULT_RAMP_MS,
  clampNumber,
  clampBeatHz,
  clampGain,
  clampBalance,
  clampRampMs,
  sanitizeBinauralParameters,
  getStereoFrequencies,
  type BinauralParameters,
} from '../src/audio/paramMapping';

const baseParams: BinauralParameters = {
  carrierHz: 220,
  beatHz: 10,
  gain: 0.2,
  balance: 0,
  noiseType: 'none',
  noiseLevel: 0,
  fadeMs: DEFAULT_RAMP_MS,
};

describe('constants match the audio DSP blueprint (Plan 02)', () => {
  it('pins the -6 dBFS linear ceiling to 0.5011872336', () => {
    expect(PEAK_CEILING_LINEAR).toBe(0.5011872336);
    // -6 dBFS = 10^(-6/20)
    expect(PEAK_CEILING_LINEAR).toBeCloseTo(Math.pow(10, -6 / 20), 9);
  });

  it('pins the beat clamp to 10..40 Hz and ramp policy to 50/75/100 ms', () => {
    expect([MIN_BEAT_HZ, MAX_BEAT_HZ]).toEqual([10, 40]);
    expect([MIN_RAMP_MS, DEFAULT_RAMP_MS, MAX_RAMP_MS]).toEqual([50, 75, 100]);
  });
});

describe('clampNumber', () => {
  it('passes through in-range values', () => {
    expect(clampNumber(5, 0, 10, 1)).toBe(5);
  });

  it('clamps below min and above max', () => {
    expect(clampNumber(-3, 0, 10, 1)).toBe(0);
    expect(clampNumber(99, 0, 10, 1)).toBe(10);
  });

  it('returns the fallback for non-finite input', () => {
    expect(clampNumber(NaN, 0, 10, 7)).toBe(7);
    expect(clampNumber(Infinity, 0, 10, 7)).toBe(7);
    expect(clampNumber(-Infinity, 0, 10, 7)).toBe(7);
  });
});

describe('clampBeatHz', () => {
  it('keeps in-range beat frequencies', () => {
    expect(clampBeatHz(10)).toBe(10);
    expect(clampBeatHz(25)).toBe(25);
    expect(clampBeatHz(40)).toBe(40);
  });

  it('clamps to the 10..40 Hz boundary', () => {
    expect(clampBeatHz(0)).toBe(10);
    expect(clampBeatHz(9.999)).toBe(10);
    expect(clampBeatHz(40.001)).toBe(40);
    expect(clampBeatHz(1000)).toBe(40);
  });

  it('falls back to MIN_BEAT_HZ for non-finite input', () => {
    expect(clampBeatHz(NaN)).toBe(10);
    expect(clampBeatHz(Infinity)).toBe(10);
  });
});

describe('clampGain enforces the -6 dBFS ceiling', () => {
  it('accepts the exact ceiling value', () => {
    expect(clampGain(PEAK_CEILING_LINEAR)).toBe(PEAK_CEILING_LINEAR);
  });

  it('never exceeds the ceiling regardless of input', () => {
    expect(clampGain(0.6)).toBe(PEAK_CEILING_LINEAR);
    expect(clampGain(1)).toBe(PEAK_CEILING_LINEAR);
    expect(clampGain(Number.MAX_VALUE)).toBe(PEAK_CEILING_LINEAR);
    expect(clampGain(PEAK_CEILING_LINEAR + 1e-9)).toBe(PEAK_CEILING_LINEAR);
  });

  it('floors negative gain at 0 and falls back to 0 for non-finite input', () => {
    expect(clampGain(-0.2)).toBe(0);
    expect(clampGain(NaN)).toBe(0);
    expect(clampGain(Infinity)).toBe(0);
  });
});

describe('clampBalance', () => {
  it('keeps the -1..1 range', () => {
    expect(clampBalance(-1)).toBe(-1);
    expect(clampBalance(0)).toBe(0);
    expect(clampBalance(1)).toBe(1);
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(clampBalance(-5)).toBe(-1);
    expect(clampBalance(5)).toBe(1);
    expect(clampBalance(NaN)).toBe(0);
  });
});

describe('clampRampMs', () => {
  it('keeps the 50..100 ms range', () => {
    expect(clampRampMs(50)).toBe(50);
    expect(clampRampMs(75)).toBe(75);
    expect(clampRampMs(100)).toBe(100);
  });

  it('clamps out-of-range values and falls back for non-finite', () => {
    expect(clampRampMs(10)).toBe(50);
    expect(clampRampMs(500)).toBe(100);
    expect(clampRampMs(NaN)).toBe(DEFAULT_RAMP_MS);
  });
});

describe('sanitizeBinauralParameters', () => {
  it('clamps every channel and floors the carrier at MAX_BEAT_HZ', () => {
    const out = sanitizeBinauralParameters({
      carrierHz: 5, // below 40 floor
      beatHz: 500, // above 40
      gain: 9, // above ceiling
      balance: 8, // above 1
      noiseType: 'pink',
      noiseLevel: 9, // above ceiling
      fadeMs: 5, // below 50
    });
    expect(out.carrierHz).toBe(MAX_BEAT_HZ);
    expect(out.beatHz).toBe(MAX_BEAT_HZ);
    expect(out.gain).toBe(PEAK_CEILING_LINEAR);
    expect(out.balance).toBe(1);
    expect(out.noiseLevel).toBe(PEAK_CEILING_LINEAR);
    expect(out.fadeMs).toBe(MIN_RAMP_MS);
    expect(out.noiseType).toBe('pink');
  });

  it('clamps the carrier ceiling and recovers non-finite carrier to 220', () => {
    expect(sanitizeBinauralParameters({...baseParams, carrierHz: 50000}).carrierHz).toBe(20000);
    expect(sanitizeBinauralParameters({...baseParams, carrierHz: NaN}).carrierHz).toBe(220);
  });

  it('leaves already-valid parameters unchanged', () => {
    expect(sanitizeBinauralParameters(baseParams)).toMatchObject(baseParams);
  });
});

describe('getStereoFrequencies', () => {
  it('derives left/right as carrier -/+ beat/2', () => {
    expect(getStereoFrequencies(220, 10)).toEqual({leftHz: 215, rightHz: 225});
  });

  it('applies the beat and carrier clamps before deriving', () => {
    // beat 4 -> clamped to 10; carrier 30 -> floored to 40
    expect(getStereoFrequencies(30, 4)).toEqual({leftHz: 35, rightHz: 45});
  });

  it('keeps left/right symmetric around the carrier', () => {
    const {leftHz, rightHz} = getStereoFrequencies(440, 30);
    expect((leftHz + rightHz) / 2).toBeCloseTo(440, 9);
    expect(rightHz - leftHz).toBeCloseTo(30, 9);
  });
});
