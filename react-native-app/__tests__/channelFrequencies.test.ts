import {describe, expect, it} from 'vitest';
import {
  channelFrequencies,
  nativeBinauralFromChannels,
  scopeStereoHz,
  SCOPE_VISUAL_MAX_BEAT_HZ,
  SCOPE_VISUAL_MIN_BEAT_HZ,
  VISUAL_BEAT_MAX_HZ,
  VISUAL_BEAT_MIN_HZ,
  visualBeatHz,
  visualStereoHz,
} from '../src/audio/channelFrequencies';
import {MAX_BEAT_HZ_PREMIUM} from '../src/audio/paramMapping';
import {mapStateToNativeAudio} from '../src/audio/engineModeMapping';

describe('channelFrequencies', () => {
  it('offsets L/R without changing stored beat', () => {
    const {leftHz, rightHz} = channelFrequencies(200, 10, 2, -3);
    expect(leftHz).toBeCloseTo(197, 5);
    expect(rightHz).toBeCloseTo(202, 5);
    expect(rightHz - leftHz).toBeCloseTo(5, 5);
  });

  it('raises center above high beats so both ears move proportionally', () => {
    const {leftHz, rightHz} = channelFrequencies(220, 1000, 0, 0);
    expect(leftHz).toBeCloseTo(20, 5);
    expect(rightHz).toBeCloseTo(1020, 5);
    expect(rightHz - leftHz).toBeCloseTo(1000, 5);
  });

  it('keeps premium-max beat differential (no stuck left channel)', () => {
    const {leftHz, rightHz} = channelFrequencies(220, 500, 0, 0);
    expect(leftHz).toBeCloseTo(20, 5);
    expect(rightHz).toBeCloseTo(520, 5);
    expect(rightHz - leftHz).toBeCloseTo(500, 5);
  });

  it('lifts the lower ear to a custom audible floor when requested', () => {
    const {leftHz, rightHz} = channelFrequencies(220, 2000, 0, 0, 120);
    expect(leftHz).toBeCloseTo(120, 5);
    expect(rightHz).toBeCloseTo(2120, 5);
    expect(rightHz - leftHz).toBeCloseTo(2000, 5);
  });

  it('back-solves native carrier and beat from effective channels', () => {
    const {leftHz, rightHz} = channelFrequencies(220, 8, 1, 1);
    const native = nativeBinauralFromChannels(leftHz, rightHz);
    expect(native.carrierHz).toBeCloseTo((leftHz + rightHz) / 2, 5);
    expect(native.beatHz).toBeCloseTo(rightHz - leftHz, 5);
  });
});

describe('visualBeatHz (oscilloscope fold — never freezes)', () => {
  it('is the identity inside the normal premium band', () => {
    expect(visualBeatHz(0.05)).toBeCloseTo(0.05, 6);
    expect(visualBeatHz(10)).toBeCloseTo(10, 6);
    expect(visualBeatHz(200)).toBeCloseTo(200, 6);
    expect(visualBeatHz(VISUAL_BEAT_MAX_HZ)).toBeCloseTo(VISUAL_BEAT_MAX_HZ, 4);
  });

  it('folds ultrasonic beats back into the lively band', () => {
    const v = visualBeatHz(1_000_000);
    expect(v).toBeGreaterThanOrEqual(VISUAL_BEAT_MIN_HZ);
    expect(v).toBeLessThanOrEqual(VISUAL_BEAT_MAX_HZ);
  });

  it('folds infrasonic beats up into the lively band', () => {
    const v = visualBeatHz(1e-9);
    expect(v).toBeGreaterThanOrEqual(VISUAL_BEAT_MIN_HZ);
    expect(v).toBeLessThanOrEqual(VISUAL_BEAT_MAX_HZ);
  });

  it('never flatlines the left visual trace at extreme beats', () => {
    for (const beat of [1e-9, 0.001, 5000, 50_000, 1_000_000]) {
      const {leftHz, rightHz} = visualStereoHz(220, beat, 0, 0);
      expect(leftHz).toBeGreaterThan(0.4);
      expect(rightHz).toBeGreaterThan(leftHz);
    }
  });
});

describe('scopeStereoHz (hub scope — exact previous look, clamped to [0.5,500])', () => {
  it('reproduces the original carrier ± beat/2 for in-range beats', () => {
    const {leftHz, rightHz} = scopeStereoHz(220, 10, 0, 0);
    expect(leftHz).toBeCloseTo(215, 5);
    expect(rightHz).toBeCloseTo(225, 5);
  });

  it('clamps the visual beat to 500 Hz so ultrasonic pitches hold the boundary', () => {
    const at500 = scopeStereoHz(220, SCOPE_VISUAL_MAX_BEAT_HZ, 0, 0);
    const ultra = scopeStereoHz(220, 50_000, 0, 0);
    expect(ultra.leftHz).toBeCloseTo(at500.leftHz, 5);
    expect(ultra.rightHz).toBeCloseTo(at500.rightHz, 5);
  });

  it('clamps the visual beat up to 0.5 Hz so infrasonic pitches hold the boundary', () => {
    const at05 = scopeStereoHz(220, SCOPE_VISUAL_MIN_BEAT_HZ, 0, 0);
    const infra = scopeStereoHz(220, 1e-6, 0, 0);
    expect(infra.leftHz).toBeCloseTo(at05.leftHz, 5);
    expect(infra.rightHz).toBeCloseTo(at05.rightHz, 5);
  });

  it('never renders a channel below 0.5 Hz at any pitch', () => {
    for (const beat of [1e-9, 0.001, 10, 500, 50_000, 1_000_000]) {
      const {leftHz, rightHz} = scopeStereoHz(220, beat, 0, 0);
      expect(leftHz).toBeGreaterThanOrEqual(0.5);
      expect(rightHz).toBeGreaterThanOrEqual(leftHz);
    }
  });
});

describe('experimental mode: dials set PITCH (carrier), slider keeps the BEAT', () => {
  it('sends the high audible pitch to the native carrier, beat unchanged', () => {
    const mapped = mapStateToNativeAudio({
      carrierHz: 20_000,
      beatHz: 10,
      gain: 0.5,
      balance: 0,
      leftDriftHz: 0,
      rightDriftHz: 0,
      phaseAngle: 0,
      engineType: 'binaural',
      tier: 'premium',
      experimentalMode: true,
    } as Parameters<typeof mapStateToNativeAudio>[0]);
    // L/R = 20k ± 5 → native carrier ≈ 20k, beat stays the slider's 10 Hz.
    expect(mapped.carrierHz).toBeCloseTo(20_000, 0);
    expect(mapped.beatHz).toBeCloseTo(10, 4);
  });

  it('clamps the beat to the tier range even in experimental mode', () => {
    const mapped = mapStateToNativeAudio({
      carrierHz: 220,
      beatHz: 50_000,
      gain: 0.5,
      balance: 0,
      leftDriftHz: 0,
      rightDriftHz: 0,
      phaseAngle: 0,
      engineType: 'binaural',
      tier: 'premium',
      experimentalMode: true,
    } as Parameters<typeof mapStateToNativeAudio>[0]);
    // Beat is never widened by experimental mode — it stays ≤ the premium max.
    expect(mapped.beatHz).toBeCloseTo(MAX_BEAT_HZ_PREMIUM, 4);
  });

  it('never takes the pitch below the audible floor (20 Hz)', () => {
    const mapped = mapStateToNativeAudio({
      carrierHz: 1,
      beatHz: 8,
      gain: 0.5,
      balance: 0,
      leftDriftHz: 0,
      rightDriftHz: 0,
      phaseAngle: 0,
      engineType: 'binaural',
      tier: 'premium',
      experimentalMode: true,
    } as Parameters<typeof mapStateToNativeAudio>[0]);
    // Carrier clamps to 20 Hz, then the binaural center lifts both ears ≥ 20 Hz.
    expect(mapped.carrierHz).toBeGreaterThanOrEqual(20);
  });
});

describe('mapStateToNativeAudio drift fold', () => {
  it('folds drift into native beat while store beat unchanged', () => {
    const mapped = mapStateToNativeAudio({
      carrierHz: 200,
      beatHz: 10,
      gain: 0.5,
      balance: 0,
      leftDriftHz: 3,
      rightDriftHz: 0,
      phaseAngle: 0,
      engineType: 'binaural',
      tier: 'free',
    } as Parameters<typeof mapStateToNativeAudio>[0]);
    expect(mapped.beatHz).toBeCloseTo(7, 5);
    expect(mapped.carrierHz).toBeCloseTo(201.5, 5);
  });
});
