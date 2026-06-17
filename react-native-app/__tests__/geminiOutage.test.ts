import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';

vi.mock('@env', () => ({
  GEMINI_API_KEY: 'AQ.test-key-long-enough-for-validation-12345',
}));

import {
  getGeminiOutageReason,
  resetGeminiOutage,
  shouldShowOutageNotice,
  geminiGuideRecommendation,
  timeUntilPacificResetLabel,
} from '../src/ai/geminiChatClient';

describe('timeUntilPacificResetLabel', () => {
  it('reports hours until the next Pacific midnight (PDT)', () => {
    // 2026-06-17 12:00 UTC = 05:00 PDT → 19h until next midnight.
    expect(timeUntilPacificResetLabel(new Date('2026-06-17T12:00:00Z'))).toBe('19h');
  });

  it('reports minutes when close to reset', () => {
    // 2026-06-17 06:30 UTC = 23:30 PDT → 30 min until next midnight.
    expect(timeUntilPacificResetLabel(new Date('2026-06-17T06:30:00Z'))).toBe('30 min');
  });
});

describe('shouldShowOutageNotice', () => {
  it('shows banner for every outage reason when using fallback', () => {
    expect(shouldShowOutageNotice('quota')).toBe(true);
    expect(shouldShowOutageNotice('auth')).toBe(true);
    expect(shouldShowOutageNotice('no-key')).toBe(true);
    expect(shouldShowOutageNotice('network')).toBe(true);
    expect(shouldShowOutageNotice('server')).toBe(true);
    expect(shouldShowOutageNotice('empty')).toBe(true);
    expect(shouldShowOutageNotice(null)).toBe(false);
  });
});

describe('geminiGuideRecommendation outage visibility', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetGeminiOutage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    resetGeminiOutage();
  });

  it('falls through every free model on 429, then reports quota', async () => {
    global.fetch = vi.fn(async () =>
      Response.json(
        {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota exceeded. Please retry in 2s.',
          },
        },
        {status: 429},
      ),
    ) as typeof fetch;

    const pending = geminiGuideRecommendation([], 'help me sleep', {
      beatHz: 10,
      carrierHz: 220,
      gain: 0.45,
      engineType: 'binaural',
      experimental: false,
    });
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).toBeNull();
    expect(getGeminiOutageReason()).toBe('quota');
    // One attempt per model in the chain (each model has its own quota pool).
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('falls through to a later model when the first is rate-limited', async () => {
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return Response.json(
          {error: {status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded. Please retry in 5s.'}},
          {status: 429},
        );
      }
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"brainwaveState":"Theta","targetFrequencyHz":6,"targetedBrainRegions":["Hippocampus"],"entrainmentStyle":"Binaural","intensityScale":0.5,"explanationShort":"Theta drift."}',
                },
              ],
            },
          },
        ],
      });
    }) as typeof fetch;

    const pending = geminiGuideRecommendation([], 'help me drift off', {
      beatHz: 10,
      carrierHz: 220,
      gain: 0.45,
      engineType: 'binaural',
      experimental: false,
    });
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).not.toBeNull();
    expect(getGeminiOutageReason()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('reports a daily-cap outage with reset wording when 429 is per-day', async () => {
    global.fetch = vi.fn(async () =>
      Response.json(
        {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota exceeded. Please retry in 30s.',
            details: [
              {
                '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                violations: [
                  {
                    quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                    quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                  },
                ],
              },
            ],
          },
        },
        {status: 429},
      ),
    ) as typeof fetch;

    const {geminiUnavailableExplanation, getGeminiQuotaScope} = await import('../src/ai/geminiChatClient');
    const pending = geminiGuideRecommendation([], 'help me focus', {
      beatHz: 10,
      carrierHz: 220,
      gain: 0.45,
      engineType: 'binaural',
      experimental: false,
    });
    await vi.runAllTimersAsync();
    await pending;

    expect(getGeminiQuotaScope()).toBe('day');
    expect(geminiUnavailableExplanation('quota')).toContain('daily');
    expect(geminiUnavailableExplanation('quota')).toContain('midnight');
  });

  it('retries 503 on the same model until success', async () => {
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call <= 2) {
        return Response.json({error: {status: 'UNAVAILABLE', message: 'high demand'}}, {status: 503});
      }
      return Response.json({
        candidates: [{content: {parts: [{text: '{"brainwaveState":"Alpha","targetFrequencyHz":10,"targetedBrainRegions":["Cortex"],"entrainmentStyle":"Binaural","intensityScale":0.5,"explanationShort":"Calm alpha."}'}]}}],
      });
    }) as typeof fetch;

    const pending = geminiGuideRecommendation([], 'help me relax', {
      beatHz: 10,
      carrierHz: 220,
      gain: 0.45,
      engineType: 'binaural',
      experimental: false,
    });
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).not.toBeNull();
    expect(getGeminiOutageReason()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('generateGuidance when Gemini is down', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetGeminiOutage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    resetGeminiOutage();
  });

  it('does not pretend local parsing understood the prompt', async () => {
    global.fetch = vi.fn(async () =>
      Response.json(
        {error: {status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded. Please retry in 1s.'}},
        {status: 429},
      ),
    ) as typeof fetch;

    const {generateGuidance} = await import('../src/components/ai/aiGuideGenerator');
    const pending = generateGuidance('stimulate a psychedelic experience', {currentBeatHz: 10});
    await vi.runAllTimersAsync();
    const rec = await pending;

    expect(rec.explanationShort).toContain('Cloud AI (Gemini)');
    expect(rec.explanationShort).not.toContain("couldn't confidently map");
    expect(rec.targetFrequencyHz).toBe(10);
  });
});
