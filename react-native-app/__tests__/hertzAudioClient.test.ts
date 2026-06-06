import {beforeEach, describe, expect, it, vi} from 'vitest';
import NativeHertzAudio from '../src/audio/specs/NativeHertzAudio';
import {HertzAudioClient} from '../src/audio/HertzAudioClient';
import {mapStateToNativeAudio} from '../src/audio/engineModeMapping';

type MapInput = Parameters<typeof mapStateToNativeAudio>[0];

const baseState = (over: Partial<MapInput>): MapInput =>
  ({
    carrierHz: 220,
    beatHz: 10,
    gain: 0.5,
    balance: 0,
    leftDriftHz: 0,
    rightDriftHz: 0,
    phaseAngle: 0,
    engineType: 'binaural',
    tier: 'free',
    ...over,
  }) as MapInput;

describe('HertzAudioClient.setBinauralParameters → native (no carrier re-cap)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards an Experimental ultrasonic pitch to native, not clamped to 1.5 kHz', () => {
    // Regression: the client used to re-run sanitizeBinauralParameters() with its
    // experimental=false default, re-clamping the carrier to MAX_CARRIER_HZ (1500)
    // right before native — capping every Experimental pitch sweep at 1.50 kHz.
    // The Ω+ dial now sets the carrier (pitch) directly, up to 20 kHz.
    const spy = vi.spyOn(NativeHertzAudio, 'setBinauralParameters');
    const mapped = mapStateToNativeAudio(
      baseState({carrierHz: 8000, beatHz: 10, tier: 'premium', experimentalMode: true}),
    );

    HertzAudioClient.setBinauralParameters(mapped);

    expect(spy).toHaveBeenCalledTimes(1);
    const carrierHzArg = spy.mock.calls[0][0];
    expect(carrierHzArg).toBeGreaterThan(1500);
    expect(carrierHzArg).toBeCloseTo(8000, 0);
  });

  it('preserves a deep-slow premium beat while keeping the pitch audible', () => {
    // The slider beat must still reach the premium floor (≈0.05 Hz) in Experimental
    // mode — the dials only widen the PITCH, never force the beat back up — while
    // the produced pitch is never taken below the audible floor (20 Hz).
    const spy = vi.spyOn(NativeHertzAudio, 'setBinauralParameters');
    const mapped = mapStateToNativeAudio(
      baseState({carrierHz: 220, beatHz: 0.05, tier: 'premium', experimentalMode: true}),
    );

    HertzAudioClient.setBinauralParameters(mapped);

    const carrierHzArg = spy.mock.calls[0][0];
    const beatHzArg = spy.mock.calls[0][1];
    expect(beatHzArg).toBeCloseTo(0.05, 5);
    expect(beatHzArg).toBeLessThan(0.5);
    expect(carrierHzArg).toBeGreaterThanOrEqual(20);
  });

  it('passes a normal binaural carrier through untouched', () => {
    const spy = vi.spyOn(NativeHertzAudio, 'setBinauralParameters');
    const mapped = mapStateToNativeAudio(baseState({carrierHz: 200, beatHz: 10}));

    HertzAudioClient.setBinauralParameters(mapped);

    expect(spy.mock.calls[0][0]).toBeCloseTo(200, 0);
  });

  it('does not cap a premium beat at the free-tier 40 Hz ceiling', () => {
    // The same re-sanitize bug also silently clamped premium beats to MAX_BEAT_HZ.
    const spy = vi.spyOn(NativeHertzAudio, 'setBinauralParameters');
    const mapped = mapStateToNativeAudio(baseState({beatHz: 300, tier: 'premium'}));

    HertzAudioClient.setBinauralParameters(mapped);

    expect(spy.mock.calls[0][1]).toBeGreaterThan(40);
  });
});
