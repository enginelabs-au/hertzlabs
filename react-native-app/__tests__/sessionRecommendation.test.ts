import {describe, expect, it} from 'vitest';
import {
  parseSessionRecommendation,
  validateSessionRecommendation,
  offlineFallbackRecommendation,
  parseSessionRecommendationOrFallback,
  SessionRecommendationParseError,
  type SessionRecommendation,
  type TelemetryContext,
} from '../src/ai/sessionRecommendation';

const validPayload: SessionRecommendation = {
  brainwaveState: 'Alpha',
  targetFrequencyHz: 10,
  targetedBrainRegions: ['Prefrontal Cortex', 'Occipital Lobe'],
  entrainmentStyle: 'Binaural',
  intensityScale: 0.5,
  explanationShort: 'Alpha relaxation.',
};

const ctx = (over: Partial<TelemetryContext> = {}): TelemetryContext => ({
  accelMagnitude: 0.4,
  gyroY: 0.5,
  roll: 0.5,
  stepCadence: 0,
  shakeDetected: false,
  currentBeatHz: 10,
  sessionState: 'playing',
  ...over,
});

describe('parseSessionRecommendation — valid schema', () => {
  it('parses a well-formed payload', () => {
    expect(parseSessionRecommendation(JSON.stringify(validPayload))).toEqual(validPayload);
  });

  it('accepts the documented numeric range edges (0.5..50 Hz, 0..1 intensity)', () => {
    expect(parseSessionRecommendation(JSON.stringify({...validPayload, targetFrequencyHz: 0.5, intensityScale: 0})).targetFrequencyHz).toBe(0.5);
    expect(parseSessionRecommendation(JSON.stringify({...validPayload, targetFrequencyHz: 50, intensityScale: 1})).intensityScale).toBe(1);
  });
});

describe('parseSessionRecommendation — rejection of malformed/partial/invalid input', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseSessionRecommendation('{ not json')).toThrow(SessionRecommendationParseError);
  });

  it('rejects a non-object payload', () => {
    expect(() => parseSessionRecommendation('"a string"')).toThrow(SessionRecommendationParseError);
    expect(() => parseSessionRecommendation('[1,2,3]')).toThrow(SessionRecommendationParseError);
  });

  it('rejects partial payloads with missing required keys', () => {
    const {intensityScale: _omit, ...partial} = validPayload;
    expect(() => parseSessionRecommendation(JSON.stringify(partial))).toThrow(/intensityScale/);
  });

  it('rejects unknown enum members', () => {
    expect(() => validateSessionRecommendation({...validPayload, brainwaveState: 'Mu'})).toThrow(/brainwaveState/);
    expect(() => validateSessionRecommendation({...validPayload, entrainmentStyle: 'Stereo'})).toThrow(/entrainmentStyle/);
    expect(() => validateSessionRecommendation({...validPayload, targetedBrainRegions: ['Cerebellum']})).toThrow(/targetedBrainRegions/);
  });

  it('rejects out-of-range numbers', () => {
    expect(() => validateSessionRecommendation({...validPayload, targetFrequencyHz: 0.49})).toThrow(/targetFrequencyHz/);
    expect(() => validateSessionRecommendation({...validPayload, targetFrequencyHz: 50.01})).toThrow(/targetFrequencyHz/);
    expect(() => validateSessionRecommendation({...validPayload, intensityScale: 1.01})).toThrow(/intensityScale/);
    expect(() => validateSessionRecommendation({...validPayload, intensityScale: -0.01})).toThrow(/intensityScale/);
  });

  it('rejects wrong types and non-finite numbers', () => {
    expect(() => validateSessionRecommendation({...validPayload, targetFrequencyHz: '10'})).toThrow();
    expect(() => validateSessionRecommendation({...validPayload, targetFrequencyHz: NaN})).toThrow();
    expect(() => validateSessionRecommendation({...validPayload, explanationShort: ''})).toThrow(/explanationShort/);
  });

  it('rejects empty region arrays and extra keys', () => {
    expect(() => validateSessionRecommendation({...validPayload, targetedBrainRegions: []})).toThrow(/targetedBrainRegions/);
    expect(() => validateSessionRecommendation({...validPayload, extra: true})).toThrow(/unexpected key/);
  });
});

describe('offlineFallbackRecommendation — Plan 04 §6.3 rule table', () => {
  it('always returns a schema-valid recommendation', () => {
    const cases = [
      ctx({shakeDetected: true}),
      ctx({accelMagnitude: 0.9}),
      ctx({stepCadence: 0.6}),
      ctx({accelMagnitude: 0.05}),
      ctx({accelMagnitude: 0.2}),
      ctx({accelMagnitude: 0.4}),
    ];
    for (const c of cases) {
      expect(() => validateSessionRecommendation(offlineFallbackRecommendation(c))).not.toThrow();
    }
  });

  it('shake overrides everything to Alpha 10 Hz', () => {
    const r = offlineFallbackRecommendation(ctx({shakeDetected: true, accelMagnitude: 0.9}));
    expect(r.brainwaveState).toBe('Alpha');
    expect(r.targetFrequencyHz).toBe(10);
  });

  it('maps high motion -> Beta 20, walking -> Beta 18, very still -> Delta 2, still -> Theta 6, default -> Alpha 10', () => {
    expect(offlineFallbackRecommendation(ctx({accelMagnitude: 0.9}))).toMatchObject({brainwaveState: 'Beta', targetFrequencyHz: 20});
    expect(offlineFallbackRecommendation(ctx({stepCadence: 0.6}))).toMatchObject({brainwaveState: 'Beta', targetFrequencyHz: 18});
    expect(offlineFallbackRecommendation(ctx({accelMagnitude: 0.05}))).toMatchObject({brainwaveState: 'Delta', targetFrequencyHz: 2});
    expect(offlineFallbackRecommendation(ctx({accelMagnitude: 0.2}))).toMatchObject({brainwaveState: 'Theta', targetFrequencyHz: 6});
    expect(offlineFallbackRecommendation(ctx({accelMagnitude: 0.4}))).toMatchObject({brainwaveState: 'Alpha', targetFrequencyHz: 10});
  });
});

describe('parseSessionRecommendationOrFallback — offline/parse error deploys local state', () => {
  it('returns the parsed value when the payload is valid', () => {
    expect(parseSessionRecommendationOrFallback(JSON.stringify(validPayload), ctx())).toEqual(validPayload);
  });

  it('instantly deploys the offline fallback on malformed JSON', () => {
    const r = parseSessionRecommendationOrFallback('garbage{', ctx({accelMagnitude: 0.05}));
    expect(r).toMatchObject({brainwaveState: 'Delta', targetFrequencyHz: 2});
    expect(() => validateSessionRecommendation(r)).not.toThrow();
  });

  it('falls back when the payload is valid JSON but violates the schema', () => {
    const bad = JSON.stringify({...validPayload, targetFrequencyHz: 999});
    const r = parseSessionRecommendationOrFallback(bad, ctx({shakeDetected: true}));
    expect(r).toMatchObject({brainwaveState: 'Alpha', targetFrequencyHz: 10});
  });
});
