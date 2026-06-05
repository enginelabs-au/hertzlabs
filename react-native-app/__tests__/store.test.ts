import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('../src/monetization/isPremiumUnlocked', () => ({
  FORCED_V1_TEST_UNLOCK: false,
  isPremiumUnlocked: (tier: string) => tier === 'premium',
}));

import {useHertzStore} from '../src/state/store';
import {persistedStoreOptions} from '../src/state/middleware/persist';
import {PEAK_CEILING_LINEAR} from '../src/audio/paramMapping';
import type {Preset} from '../src/state/types';

const get = () => useHertzStore.getState();

beforeEach(() => {
  // Fully reset to the creation-time state (data + actions) before each test.
  useHertzStore.setState(useHertzStore.getInitialState(), true);
});

describe('default audio params', () => {
  it('starts inside every safety bound', () => {
    const s = get();
    expect(s.carrierHz).toBe(220);
    expect(s.beatHz).toBe(10);
    expect(s.gain).toBe(0.45);
    expect(s.balance).toBe(0);
    expect(s.waveform).toBe('sine');
    expect(s.noiseType).toBe('none');
    expect(s.noiseLayers).toEqual({white: false, pink: false, brown: false});
    expect(s.tier).toBe('free');
  });
});

describe('setParam clamps to the DSP-safe ranges', () => {
  it('clamps gain to the -6 dBFS ceiling and floors at 0', () => {
    get().setParam('gain', 0.95);
    expect(get().gain).toBe(PEAK_CEILING_LINEAR);
    get().setParam('gain', -2);
    expect(get().gain).toBe(0);
  });

  it('clamps beatHz to 0.5..40 on free tier (Plan 05)', () => {
    get().setParam('beatHz', 999);
    expect(get().beatHz).toBe(40);
    get().setParam('beatHz', 0.01);
    expect(get().beatHz).toBe(0.5);
    get().setParam('beatHz', 0.2);
    expect(get().beatHz).toBe(0.5);
  });

  it('clamps balance to -1..1 and floors carrier at 20 Hz', () => {
    get().setParam('balance', 9);
    expect(get().balance).toBe(1);
    get().setParam('carrierHz', 5);
    expect(get().carrierHz).toBe(20);
  });

  it('recovers from non-finite input via the documented fallbacks', () => {
    get().setParam('beatHz', NaN);
    expect(get().beatHz).toBe(0.5);
    get().setParam('gain', Infinity);
    expect(get().gain).toBe(0);
  });
});

describe('applyPreset', () => {
  it('applies and sanitizes preset parameters in one shot', () => {
    const preset: Preset = {
      id: 'unsafe',
      name: 'Unsafe',
      params: {
        carrierHz: 1, // below 20 floor
        beatHz: 80, // above 40
        gain: 5, // above ceiling
        balance: -9, // below -1
        waveform: 'triangle',
        noiseType: 'white',
        noiseLevel: 5,
        fadeMs: 10,
        phaseAngle: 0,
        leftDriftHz: 0,
        rightDriftHz: 0,
      },
    };
    get().applyPreset(preset);
    const s = get();
    expect(s.carrierHz).toBe(20);
    expect(s.beatHz).toBe(40);
    expect(s.gain).toBe(PEAK_CEILING_LINEAR);
    expect(s.balance).toBe(-1);
    expect(s.waveform).toBe('triangle');
    expect(s.noiseType).toBe('white');
    expect(s.noiseLevel).toBe(PEAK_CEILING_LINEAR);
    expect(s.noiseLayers.white).toBe(true);
    expect(s.fadeMs).toBe(50);
  });

  it('toggles noise layers independently', () => {
    get().toggleNoiseLayer('pink');
    expect(get().noiseLayers.pink).toBe(true);
    get().toggleNoiseLayer('white');
    expect(get().noiseLayers.white).toBe(true);
    expect(get().noiseLayers.pink).toBe(true);
  });
});

describe('subscription gating (both directions)', () => {
  it('upgrades to premium and back to free', () => {
    expect(get().tier).toBe('free');
    get().setSubscription('premium', ['premium']);
    expect(get().tier).toBe('premium');
    expect(get().entitlements).toEqual(['premium']);
    expect(get().tier === 'premium').toBe(true);

    get().setSubscription('free', []);
    expect(get().tier).toBe('free');
    expect(get().tier === 'premium').toBe(false);
  });
});

describe('session reducers', () => {
  it('toggles play / pause / stop intent', () => {
    get().requestPlay();
    expect([get().isPlaying, get().isPaused]).toEqual([true, false]);
    get().requestPause();
    expect([get().isPlaying, get().isPaused]).toEqual([false, true]);
    get().requestStop();
    expect([get().isPlaying, get().isPaused, get().elapsedSec]).toEqual([false, false, 0]);
  });

  it('never lets elapsedSec go negative', () => {
    get().setElapsedSec(-50);
    expect(get().elapsedSec).toBe(0);
    get().setElapsedSec(42);
    expect(get().elapsedSec).toBe(42);
  });
});

describe('engine mirror reducers', () => {
  it('merges native state and preserves unspecified fields', () => {
    get()._ingestNativeState({state: 'playing', sampleRate: 44100, highVolumeWarningTriggered: true});
    expect(get().state).toBe('playing');
    expect(get().sampleRate).toBe(44100);
    expect(get().highVolumeWarningTriggered).toBe(true);
    expect(get().outputRoute).toBe('unknown'); // untouched default preserved
  });

  it('routes native errors to the error state', () => {
    get()._ingestNativeError('E_AUDIO: boom');
    expect(get().state).toBe('error');
    expect(get().lastError).toBe('E_AUDIO: boom');
  });
});

describe('preset slice', () => {
  it('adds and de-duplicates, then removes custom presets', () => {
    const p: Preset = {
      id: 'p1',
      name: 'One',
      params: {
        carrierHz: 220,
        beatHz: 10,
        gain: 0.2,
        balance: 0,
        waveform: 'sine',
        noiseType: 'none',
        noiseLevel: 0,
        fadeMs: 75,
        phaseAngle: 0,
        leftDriftHz: 0,
        rightDriftHz: 0,
      },
    };
    get().addCustomPreset(p);
    get().addCustomPreset({...p, name: 'One v2'});
    expect(get().custom).toHaveLength(1);
    expect(get().custom[0].name).toBe('One v2');
    get().removeCustomPreset('p1');
    expect(get().custom).toHaveLength(0);
  });
});

describe('persist policy (Plan 01 §6) — partialize', () => {
  it('persists only durable slices and never ephemeral runtime/audio state', () => {
    const persisted = persistedStoreOptions.partialize(get());
    const keys = Object.keys(persisted).sort();
    expect(keys).toEqual(
      [
        'backgroundAudio',
        'beatSliderScale',
        'custom',
        'defaultDurationSec',
        'engineType',
        'entitlements',
        'haptics',
        'hasAcceptedSafetyTerms',
        'isKineticModeEnabled',
        'keepAwake',
        'lastUsedParams',
        'onboardingDone',
        'theme',
        'tier',
      ].sort(),
    );
    // Ephemeral state must NOT be persisted.
    for (const ephemeral of ['beatHz', 'gain', 'isPlaying', 'state', 'elapsedSec', 'prompt']) {
      expect(persisted).not.toHaveProperty(ephemeral);
    }
  });
});
