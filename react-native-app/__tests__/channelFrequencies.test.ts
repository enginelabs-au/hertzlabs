import {describe, expect, it} from 'vitest';
import {
  channelFrequencies,
  nativeBinauralFromChannels,
} from '../src/audio/channelFrequencies';
import {mapStateToNativeAudio} from '../src/audio/engineModeMapping';

describe('channelFrequencies', () => {
  it('offsets L/R without changing stored beat', () => {
    const {leftHz, rightHz} = channelFrequencies(200, 10, 2, -3);
    expect(leftHz).toBeCloseTo(197, 5);
    expect(rightHz).toBeCloseTo(202, 5);
    expect(rightHz - leftHz).toBeCloseTo(5, 5);
  });

  it('back-solves native carrier and beat from effective channels', () => {
    const {leftHz, rightHz} = channelFrequencies(220, 8, 1, 1);
    const native = nativeBinauralFromChannels(leftHz, rightHz);
    expect(native.carrierHz).toBeCloseTo((leftHz + rightHz) / 2, 5);
    expect(native.beatHz).toBeCloseTo(rightHz - leftHz, 5);
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
