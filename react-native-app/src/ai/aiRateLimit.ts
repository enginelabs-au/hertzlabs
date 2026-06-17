/**
 * Client-side AI usage guard.
 *
 * The Gemini free tier caps requests-per-minute; this throttles the user a step
 * BEFORE that ceiling so we never burn the real quota (and so cost stays
 * bounded). When the rolling-window cap is reached the chat is cut off until the
 * oldest call ages out of the window — i.e. it cools down and resets on its own.
 */

/** Rolling window the cap is measured over. */
export const AI_RATE_WINDOW_MS = 60_000;
/** Soft cap per window — deliberately below the provider RPM limit. */
export const AI_RATE_MAX_CALLS = 12;
/** Warn the user once they are this close to the cap. */
export const AI_RATE_WARN_REMAINING = 3;

export type AiRateStatus = {
  allowed: boolean;
  /** Calls left in the current window (0 when blocked). */
  remaining: number;
  /** ms until the next call is allowed (0 when allowed). */
  retryAfterMs: number;
  /** True when allowed but close to the cap. */
  nearLimit: boolean;
};

/** Drop timestamps that have aged out of the rolling window. */
export function pruneCallLog(callLog: readonly number[], now: number): number[] {
  const windowStart = now - AI_RATE_WINDOW_MS;
  return callLog.filter(t => t > windowStart);
}

/** Decide whether a new AI call is allowed given prior call timestamps. */
export function evaluateAiRateLimit(callLog: readonly number[], now: number): AiRateStatus {
  const recent = pruneCallLog(callLog, now);
  const used = recent.length;

  if (used >= AI_RATE_MAX_CALLS) {
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + AI_RATE_WINDOW_MS - now),
      nearLimit: true,
    };
  }

  const remaining = AI_RATE_MAX_CALLS - used;
  return {
    allowed: true,
    remaining,
    retryAfterMs: 0,
    nearLimit: remaining <= AI_RATE_WARN_REMAINING,
  };
}

/** User-facing cooldown notice. */
export function formatCooldownMessage(retryAfterMs: number): string {
  const sec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `You're sending requests very quickly. To keep the AI responsive and within usage limits, please wait about ${sec}s before your next request.`;
}

/** Short trailing hint appended when the user is close to (but not at) the cap. */
export function formatNearLimitHint(remaining: number): string {
  return `\n\n(${remaining} more AI request${remaining === 1 ? '' : 's'} available this minute before a short cooldown.)`;
}
