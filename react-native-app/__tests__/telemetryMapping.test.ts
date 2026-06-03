import {describe, expect, it} from 'vitest';
import {
  gyroToPhase,
  rollToBalance,
  pitchToNoiseLevel,
  headingToEarthMix,
  cadenceToBeatHz,
} from '../src/audio/telemetryMapping';

// Normalized gyro for a given raw rad/s: gyroY_raw = n*2π - π  =>  n = (raw + π) / (2π)
const normFromRawGyro = (raw: number) => (raw + Math.PI) / (2 * Math.PI);

describe('gyroToPhase (Plan 04 §2.1: Phase = min(360, gyroY_raw * 50))', () => {
  it('returns null at/below the 0.1 rad/s activity threshold', () => {
    expect(gyroToPhase(0.5)).toBeNull(); // raw 0
    expect(gyroToPhase(normFromRawGyro(0.09))).toBeNull(); // just inside threshold
    expect(gyroToPhase(normFromRawGyro(-0.09))).toBeNull(); // just inside threshold
  });

  it('begins emitting just above the 0.1 rad/s threshold', () => {
    expect(gyroToPhase(normFromRawGyro(0.11))).toBeCloseTo(0.11 * 50, 6); // 5.5
  });

  it('maps above-threshold rotation through raw * 50', () => {
    expect(gyroToPhase(normFromRawGyro(0.2))).toBeCloseTo(0.2 * 50, 6); // 10
    expect(gyroToPhase(normFromRawGyro(2))).toBeCloseTo(100, 6);
  });

  it('passes negative rotation straight through (min keeps the negative value)', () => {
    expect(gyroToPhase(normFromRawGyro(-2))).toBeCloseTo(-100, 6);
  });

  it('caps the phase at 360 degrees', () => {
    // raw 9 rad/s -> 450 -> capped to 360
    expect(gyroToPhase(normFromRawGyro(9))).toBe(360);
  });
});

describe('rollToBalance (Plan 04 §2.3: (roll - 0.5) * 2 -> [-1, 1])', () => {
  it('maps level (0.5) to centered balance', () => {
    expect(rollToBalance(0.5)).toBe(0);
  });

  it('maps the normalized extremes to the balance extremes', () => {
    expect(rollToBalance(0)).toBe(-1);
    expect(rollToBalance(1)).toBe(1);
  });

  it('stays within [-1, 1] across the normalized domain', () => {
    for (let n = 0; n <= 1; n += 0.05) {
      const balance = rollToBalance(n);
      expect(balance).toBeGreaterThanOrEqual(-1);
      expect(balance).toBeLessThanOrEqual(1);
    }
  });
});

describe('pitchToNoiseLevel and headingToEarthMix (pass-through, stay in [0,1])', () => {
  it('passes pitch through unchanged within [0,1]', () => {
    expect(pitchToNoiseLevel(0)).toBe(0);
    expect(pitchToNoiseLevel(0.5)).toBe(0.5);
    expect(pitchToNoiseLevel(1)).toBe(1);
  });

  it('passes heading through unchanged within [0,1]', () => {
    expect(headingToEarthMix(0)).toBe(0);
    expect(headingToEarthMix(0.42)).toBe(0.42);
    expect(headingToEarthMix(1)).toBe(1);
  });
});

describe('cadenceToBeatHz (Plan 04 §2.5: 10 + cadence*30, stays inside the 10..40 clamp)', () => {
  it('maps the cadence extremes to the beat band edges', () => {
    expect(cadenceToBeatHz(0)).toBe(10);
    expect(cadenceToBeatHz(1)).toBe(40);
  });

  it('maps the midpoint to 25 Hz', () => {
    expect(cadenceToBeatHz(0.5)).toBe(25);
  });

  it('never leaves the 10..40 Hz band for normalized cadence', () => {
    for (let n = 0; n <= 1; n += 0.05) {
      const hz = cadenceToBeatHz(n);
      expect(hz).toBeGreaterThanOrEqual(10);
      expect(hz).toBeLessThanOrEqual(40);
    }
  });
});
