import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import {inferBeatHzFromPrompt} from '../src/ai/parseProtocolFromPrompt';
import {resetGeminiOutage} from '../src/ai/geminiChatClient';
import {generateGuidance} from '../src/components/ai/aiGuideGenerator';

vi.mock('@env', () => ({
  GEMINI_API_KEY: 'AQ.test-key-long-enough-for-validation-12345',
}));

describe('inferBeatHzFromPrompt', () => {
  it('maps band names', () => {
    expect(inferBeatHzFromPrompt('settle into theta')).toBe(6);
    expect(inferBeatHzFromPrompt('ramp down to delta')).toBe(2.5);
  });

  it('maps state language without exact hz', () => {
    expect(inferBeatHzFromPrompt('help me concentrate for a tough exam')).toBe(14);
    expect(inferBeatHzFromPrompt('restorative sleep after a stressful day')).toBe(2.5);
    expect(inferBeatHzFromPrompt('I need to hyper-focus for coding')).toBe(22);
  });

  it('returns null for unrelated text', () => {
    expect(inferBeatHzFromPrompt('what is the weather')).toBeNull();
  });
});

describe('generateGuidance when cloud AI is down', () => {
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

  it('keeps current Hz and reports Gemini unavailable instead of guessing', async () => {
    global.fetch = vi.fn(async () =>
      Response.json(
        {error: {status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded. Please retry in 1s.'}},
        {status: 429},
      ),
    ) as typeof fetch;

    const pending = generateGuidance('quantum flux harmonizer mode', {currentBeatHz: 22});
    await vi.runAllTimersAsync();
    const rec = await pending;

    expect(rec.targetFrequencyHz).toBe(22);
    expect(rec.explanationShort).toContain('Cloud AI (Gemini)');
    expect(rec.explanationShort).not.toContain("couldn't confidently map");
  });
});
