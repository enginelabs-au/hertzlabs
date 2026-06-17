/**
 * Normalize beat/entrainment Hz values from model output or user text.
 * Fixes the common failure mode where Gemini puts carrier/kHz magnitudes (e.g. 10000)
 * into beat fields meant for 0.05–500 Hz entrainment.
 */
export function sanitizeBeatHzFromModel(
  raw: unknown,
  maxBeatHz = 500,
  minBeatHz = 0.05,
): number | null {
  const hz = coerceBeatHzRaw(raw);
  if (hz == null) {
    return null;
  }
  let v = hz;

  // "10 kHz" written as 10000 in a beat field → treat as kHz confusion when /1000 lands in range.
  if (v > maxBeatHz && v >= 1000 && v <= 1_000_000) {
    const asKhz = v / 1000;
    if (asKhz >= minBeatHz && asKhz <= maxBeatHz) {
      v = asKhz;
    }
  }

  if (v > maxBeatHz) {
    v = maxBeatHz;
  }
  if (v < minBeatHz) {
    v = minBeatHz;
  }
  return Number.isFinite(v) ? v : null;
}

function coerceBeatHzRaw(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const t = raw.trim().toLowerCase();
  if (!t) {
    return null;
  }

  const khz = t.match(/^(\d+(?:\.\d+)?)\s*khz$/);
  if (khz) {
    const n = parseFloat(khz[1]);
    return Number.isFinite(n) && n > 0 ? n * 1000 : null;
  }

  const mhz = t.match(/^(\d+(?:\.\d+)?)\s*mhz$/);
  if (mhz) {
    const n = parseFloat(mhz[1]);
    return Number.isFinite(n) && n > 0 ? n * 1_000_000 : null;
  }

  const hz = t.match(/^(\d+(?:\.\d+)?)\s*hz$/);
  if (hz) {
    const n = parseFloat(hz[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const bare = parseFloat(t);
  return Number.isFinite(bare) && bare > 0 ? bare : null;
}

/** True when the user explicitly asked to change pitch/carrier (not entrainment beat). */
export function promptMentionsCarrierOrPitch(text: string): boolean {
  // Literal "10 kHz" / "440 hz" pitch requests are carrier, not beat entrainment.
  if (/\b\d+(?:\.\d+)?\s*khz\b/i.test(text)) {
    return true;
  }
  return /\b(carrier|pitch|tone|Ω|omega|audible|oscillator|wave\s+pitch)\b/i.test(text);
}

/** Parse explicit carrier pitch in Hz from user text (e.g. "10 kHz" → 10000). */
export function parseCarrierHzFromPrompt(text: string): number | null {
  const khz = text.match(/\b(\d+(?:\.\d+)?)\s*khz\b/i);
  if (khz) {
    const v = parseFloat(khz[1]) * 1000;
    return Number.isFinite(v) && v >= 20 ? Math.min(v, 20_000) : null;
  }
  const hz = text.match(/\b(?:carrier|pitch|tone)\s*(?:at|to|=|:)?\s*(\d+(?:\.\d+)?)\s*hz\b/i);
  if (hz) {
    const v = parseFloat(hz[1]);
    return Number.isFinite(v) && v >= 20 ? Math.min(v, 20_000) : null;
  }
  return null;
}
