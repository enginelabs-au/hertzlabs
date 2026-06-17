import {describe, expect, it} from 'vitest';
import {
  AI_RATE_MAX_CALLS,
  AI_RATE_WINDOW_MS,
  evaluateAiRateLimit,
  formatCooldownMessage,
  pruneCallLog,
} from '../src/ai/aiRateLimit';

const now = 1_000_000;

describe('pruneCallLog', () => {
  it('keeps only timestamps within the rolling window', () => {
    const log = [now - AI_RATE_WINDOW_MS - 1, now - AI_RATE_WINDOW_MS + 1, now - 1];
    expect(pruneCallLog(log, now)).toEqual([now - AI_RATE_WINDOW_MS + 1, now - 1]);
  });
});

describe('evaluateAiRateLimit', () => {
  it('allows calls below the cap and reports remaining', () => {
    const r = evaluateAiRateLimit([now - 1, now - 2], now);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(AI_RATE_MAX_CALLS - 2);
    expect(r.retryAfterMs).toBe(0);
  });

  it('blocks at the cap and computes retryAfterMs from the oldest in-window call', () => {
    const oldest = now - 10_000;
    const log = Array.from({length: AI_RATE_MAX_CALLS}, (_, i) => (i === 0 ? oldest : now - 1));
    const r = evaluateAiRateLimit(log, now);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterMs).toBe(oldest + AI_RATE_WINDOW_MS - now);
  });

  it('ignores aged-out calls when counting', () => {
    const log = Array.from({length: AI_RATE_MAX_CALLS}, () => now - AI_RATE_WINDOW_MS - 5);
    const r = evaluateAiRateLimit(log, now);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(AI_RATE_MAX_CALLS);
  });

  it('flags nearLimit as the cap approaches', () => {
    const log = Array.from({length: AI_RATE_MAX_CALLS - 1}, () => now - 1);
    const r = evaluateAiRateLimit(log, now);
    expect(r.allowed).toBe(true);
    expect(r.nearLimit).toBe(true);
  });
});

describe('formatCooldownMessage', () => {
  it('rounds up to whole seconds and never shows 0', () => {
    expect(formatCooldownMessage(0)).toContain('1s');
    expect(formatCooldownMessage(2400)).toContain('3s');
  });
});
