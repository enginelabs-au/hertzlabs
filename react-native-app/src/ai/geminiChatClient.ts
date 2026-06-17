import {GEMINI_API_KEY} from '@env';
import type {ChatTurn} from './aiPromptParsing';
import {buildConversationContents} from './aiPromptParsing';
import {buildUserConversationText} from './parseProtocolFromPrompt';

export const FREE_TIER_GEMINI_MODEL = 'gemini-2.5-flash-lite';

/**
 * Each free model has its OWN separate per-minute AND per-day request pool, so
 * trying several multiplies effective free capacity and routes around demand
 * spikes / exhausted models. Failed (429/503) calls do not consume successful
 * quota, so falling through is free. Ordered by typical free-tier generosity.
 */
const GEMINI_MODEL_CHAIN = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
] as const;

/** Backoff between 503 / overload retries on the SAME model — keep total wait small. */
const TRANSIENT_BACKOFF_MS = [1_200, 2_500] as const;
const MAX_TRANSIENT_RETRIES_PER_MODEL = 2;
/** Hard cap so one chat turn never blocks the UI too long even across the whole chain. */
const GEMINI_CALL_DEADLINE_MS = 15_000;

function geminiModelUrl(model: (typeof GEMINI_MODEL_CHAIN)[number]): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export type GeminiSessionContext = {
  beatHz: number;
  carrierHz: number;
  gain: number;
  engineType: string;
  experimental: boolean;
  /** Premium unlocked — widens beat range and unlocks advanced engine modes. */
  premium?: boolean;
};

type GeminiContentPart = {text: string};
type GeminiContent = {role?: string; parts: GeminiContentPart[]};

type GeminiCallOptions = {
  maxOutputTokens?: number;
  temperature?: number;
  systemSuffix?: string;
};

function getApiKey(): string | null {
  const key = (GEMINI_API_KEY ?? '').replace(/\r/g, '').trim();
  return key.length > 10 && !key.startsWith('REPLACE_') ? key : null;
}

/**
 * Why the most recent Gemini call did not return a usable answer. Lets the UI
 * tell the difference between "the model thought about it" and "the AI service
 * never ran" (so we never silently present a local fallback as a real answer).
 *   quota   — 429 / RESOURCE_EXHAUSTED (rate limit or billing/credits)
 *   auth    — 4xx key/permission problem (invalid or restricted key)
 *   server  — 5xx after retry
 *   network — fetch threw (offline / DNS / TLS)
 *   no-key  — no usable GEMINI_API_KEY configured
 *   empty   — call succeeded but returned no text
 */
export type GeminiOutageReason = 'quota' | 'auth' | 'server' | 'network' | 'no-key' | 'empty';
let lastOutageReason: GeminiOutageReason | null = null;
/** 'day' when the exhausted quota is a per-day free-tier cap (resets midnight Pacific), 'minute' for RPM. */
let lastQuotaScope: 'day' | 'minute' | null = null;
/** Skip Gemini HTTP until this timestamp (429 / RESOURCE_EXHAUSTED). */
let quotaBlockedUntilMs = 0;

/** Clear the outage flag at the start of a fresh user turn. */
export function resetGeminiOutage(): void {
  lastOutageReason = null;
}

/** 'day' = free daily cap exhausted (resets ~midnight Pacific); 'minute' = short RPM cooldown. */
export function getGeminiQuotaScope(): 'day' | 'minute' | null {
  return lastQuotaScope;
}

/** Non-null when the AI service itself failed during the last call(s) this turn. */
export function getGeminiOutageReason(): GeminiOutageReason | null {
  return lastOutageReason;
}

/** True when a recent 429 means we should not burn more API calls this session. */
export function isGeminiQuotaBlocked(): boolean {
  return Date.now() < quotaBlockedUntilMs;
}

/** Clear outage only after Gemini returns a usable answer — never when a local preset ran. */
export function clearOutageAfterSuccessfulFallback(): void {
  lastOutageReason = null;
  lastQuotaScope = null;
  quotaBlockedUntilMs = 0;
}

/** @deprecated use clearOutageAfterSuccessfulFallback */
export function clearOutageUnlessQuota(): void {
  clearOutageAfterSuccessfulFallback();
}

/** Show banner whenever cloud AI did not answer this turn. */
export function shouldShowOutageNotice(reason: GeminiOutageReason | null): boolean {
  return reason != null;
}

/** Outages where a lighter follow-up Gemini call (e.g. guide after protocol) may succeed. */
export function isTransientGeminiOutage(reason: GeminiOutageReason | null): boolean {
  return reason === 'server' || reason === 'empty' || reason === 'network';
}

/** Allow a fresh Gemini attempt after a transient failure on a heavier request (protocol). */
export function resetGeminiOutageForRetry(): void {
  lastOutageReason = null;
}

function markQuotaBlocked(retryAfterMs: number): void {
  lastOutageReason = 'quota';
  const delay = Math.max(retryAfterMs, 5_000);
  quotaBlockedUntilMs = Math.max(quotaBlockedUntilMs, Date.now() + delay);
}

type QuotaErrorBody = {
  error?: {
    message?: string;
    details?: {
      ['@type']?: string;
      retryDelay?: string;
      violations?: {quotaId?: string; quotaMetric?: string}[];
    }[];
  };
};

function parseQuotaRetryMs(errorBody: QuotaErrorBody): number {
  const msg = errorBody?.error?.message ?? '';
  const secMatch = msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (secMatch) {
    return Math.ceil(parseFloat(secMatch[1]) * 1000);
  }
  for (const detail of errorBody?.error?.details ?? []) {
    if (detail['@type']?.includes('RetryInfo') && detail.retryDelay) {
      const raw = String(detail.retryDelay).replace(/s$/i, '');
      const sec = parseFloat(raw);
      if (Number.isFinite(sec)) {
        return Math.ceil(sec * 1000);
      }
    }
  }
  return 60_000;
}

/** Distinguish a per-day free-tier cap (won't recover for hours) from a per-minute RPM cooldown. */
function parseQuotaScope(errorBody: QuotaErrorBody): 'day' | 'minute' {
  for (const detail of errorBody?.error?.details ?? []) {
    for (const v of detail.violations ?? []) {
      const id = `${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`;
      if (/per\s*day/i.test(id)) {
        return 'day';
      }
    }
  }
  return 'minute';
}

function classifyHttpError(status: number, bodyStatus: string | undefined): GeminiOutageReason {
  if (status === 429 || bodyStatus === 'RESOURCE_EXHAUSTED') {
    return 'quota';
  }
  if (status === 401 || status === 403 || status === 400) {
    return 'auth';
  }
  return 'server';
}

/** True when assistant text already includes the cloud-AI outage explanation. */
export function messageExplainsGeminiOutage(text: string): boolean {
  return text.startsWith('Cloud AI (Gemini)');
}

/** Pull parseable JSON (object or array) out of model text. */
export function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  if (!body) {
    return body;
  }

  // Fast path — already valid JSON.
  try {
    JSON.parse(body);
    return body;
  } catch {
    // fall through to bracket extraction
  }

  // Root array vs object — pick the outer wrapper so nested `[]` in objects is not stolen.
  const tryArray = (): string | null => {
    const arrayStart = body.indexOf('[');
    const arrayEnd = body.lastIndexOf(']');
    if (arrayStart < 0 || arrayEnd <= arrayStart) {
      return null;
    }
    const slice = body.slice(arrayStart, arrayEnd + 1);
    try {
      JSON.parse(slice);
      return slice;
    } catch {
      return null;
    }
  };

  const tryObject = (): string | null => {
    const objStart = body.indexOf('{');
    const objEnd = body.lastIndexOf('}');
    if (objStart < 0 || objEnd <= objStart) {
      return null;
    }
    const slice = body.slice(objStart, objEnd + 1);
    try {
      JSON.parse(slice);
      return slice;
    } catch {
      return null;
    }
  };

  if (body.startsWith('[')) {
    return tryArray() ?? tryObject() ?? body;
  }
  if (body.startsWith('{')) {
    return tryObject() ?? tryArray() ?? body;
  }
  return tryObject() ?? tryArray() ?? body;
}

/** Common Gemini JSON mistakes — missing `}` between step objects, trailing commas. */
function repairModelJsonText(json: string): string {
  let out = json;
  // `"curve": "logarithmic"\n    ,\n    {` → add missing `}` before the comma.
  out = out.replace(/\n(\s*),\n(\s*)\{/g, (match, ws1, ws2, offset, full) => {
    const before = full.slice(Math.max(0, offset - 120), offset);
    if (/[}\]]\s*$/.test(before.trimEnd())) {
      return match;
    }
    return `\n${ws1}},\n${ws2}{`;
  });
  out = out.replace(/,\s*([}\]])/g, '$1');
  return out;
}

/** Parse model JSON text with lightweight repair before giving up. */
export function parseModelJson(raw: string): unknown | null {
  const extracted = extractJsonText(raw);
  const candidates = [extracted, repairModelJsonText(extracted)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try next repair pass
    }
  }
  return null;
}

async function callGeminiJson(
  systemPrompt: string,
  history: ChatTurn[],
  latestPrompt: string,
  sessionLine: string,
  options: GeminiCallOptions = {},
): Promise<unknown | null> {
  const apiKey = getApiKey();
  if (apiKey == null) {
    lastOutageReason = 'no-key';
    return null;
  }
  const contents: GeminiContent[] = buildConversationContents(history, latestPrompt).map(turn => ({
    role: turn.role,
    parts: [{text: turn.text}],
  }));

  const suffix =
    options.systemSuffix ??
    'Focus on the user\'s latest message. Honor explicit Hz and timing values from the conversation.';

  const body = {
    systemInstruction: {
      parts: [
        {
          text: `${systemPrompt}\n\nCurrent live session: ${sessionLine}\n\n${suffix}`,
        },
      ],
    },
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxOutputTokens ?? 512,
      responseMimeType: 'application/json',
    },
  };

  const fetchOptionsBase: Omit<RequestInit, 'body'> = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Header auth avoids RN/Hermes URL parse failures with special chars in query keys.
      'x-goog-api-key': apiKey,
    },
  };

  let sawQuota = false;
  let everyFailureWasQuota = true;
  let minQuotaRetryMs = Number.POSITIVE_INFINITY;
  const deadline = Date.now() + GEMINI_CALL_DEADLINE_MS;

  for (const model of GEMINI_MODEL_CHAIN) {
    if (Date.now() >= deadline) {
      break;
    }
    const url = geminiModelUrl(model);

    // Per-model: one call + a couple of quick retries ONLY for transient overload (503/5xx).
    for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES_PER_MODEL; attempt += 1) {
      if (Date.now() >= deadline) {
        break;
      }
      try {
        const res = await fetch(url, {...fetchOptionsBase, body: JSON.stringify(body)});

        if (!res.ok) {
          type ErrorJson = QuotaErrorBody & {error?: {status?: string}};
          let errorJson: ErrorJson | undefined;
          try {
            errorJson = (await res.json()) as ErrorJson;
          } catch {
            errorJson = undefined;
          }
          const bodyStatus = errorJson?.error?.status;

          // Rate / quota limit on THIS model → try the next model immediately (separate pool).
          if (res.status === 429 || bodyStatus === 'RESOURCE_EXHAUSTED') {
            sawQuota = true;
            minQuotaRetryMs = Math.min(minQuotaRetryMs, parseQuotaRetryMs(errorJson ?? {}));
            const scope = parseQuotaScope(errorJson ?? {});
            // Prefer 'minute' if any model has a recoverable per-minute cooldown.
            if (lastQuotaScope !== 'minute') {
              lastQuotaScope = scope;
            }
            lastOutageReason = 'quota';
            break;
          }

          // Bad key / request → no point trying other models.
          if (res.status === 401 || res.status === 403 || res.status === 400) {
            lastOutageReason = classifyHttpError(res.status, bodyStatus);
            return null;
          }

          // Transient overload → quick retry on the same model, then fall through to next.
          if (res.status === 503 || bodyStatus === 'UNAVAILABLE' || res.status >= 500) {
            everyFailureWasQuota = false;
            lastOutageReason = 'server';
            if (attempt < MAX_TRANSIENT_RETRIES_PER_MODEL && Date.now() < deadline) {
              const waitMs = Math.min(TRANSIENT_BACKOFF_MS[attempt] ?? 2_500, deadline - Date.now());
              if (waitMs > 0) {
                await new Promise<void>(r => setTimeout(r, waitMs));
              }
              continue;
            }
            break;
          }

          everyFailureWasQuota = false;
          lastOutageReason = classifyHttpError(res.status, bodyStatus);
          break;
        }

        let json: {
          candidates?: {content?: {parts?: {text?: string}[]}; finishReason?: string}[];
          error?: {message?: string};
        };
        try {
          json = (await res.json()) as typeof json;
        } catch {
          everyFailureWasQuota = false;
          lastOutageReason = 'server';
          break;
        }
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text == null || text.trim().length === 0) {
          everyFailureWasQuota = false;
          lastOutageReason = 'empty';
          break;
        }
        const parsed = parseModelJson(text);
        if (parsed != null) {
          clearOutageAfterSuccessfulFallback();
          return parsed;
        }
        everyFailureWasQuota = false;
        lastOutageReason = 'empty';
        break;
      } catch {
        everyFailureWasQuota = false;
        lastOutageReason = 'network';
        if (attempt < MAX_TRANSIENT_RETRIES_PER_MODEL && Date.now() < deadline) {
          const waitMs = Math.min(TRANSIENT_BACKOFF_MS[attempt] ?? 2_500, deadline - Date.now());
          if (waitMs > 0) {
            await new Promise<void>(r => setTimeout(r, waitMs));
          }
          continue;
        }
        break;
      }
    }
  }

  // Only suppress further calls this session when every model failed purely on quota.
  if (sawQuota && everyFailureWasQuota) {
    lastOutageReason = 'quota';
    const block = lastQuotaScope === 'day' ? 10 * 60_000 : Math.min(minQuotaRetryMs, 60_000);
    markQuotaBlocked(block);
  }
  return null;
}

/**
 * Magnitude of time until the next midnight in US Pacific (where Gemini's free
 * daily quota resets), e.g. "7h 30m". Empty string if the runtime can't resolve
 * the zone, so callers fall back to static wording.
 */
export function timeUntilPacificResetLabel(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const read = (type: string): number => Number(parts.find(p => p.type === type)?.value);
    let hour = read('hour');
    const minute = read('minute');
    const second = read('second');
    if (![hour, minute, second].every(Number.isFinite)) {
      return '';
    }
    if (hour === 24) {
      hour = 0; // some engines emit 24 at midnight
    }
    const secondsLeft = 24 * 3600 - (hour * 3600 + minute * 60 + second);
    if (secondsLeft <= 60) {
      return 'under a minute';
    }
    const hoursLeft = Math.floor(secondsLeft / 3600);
    const minutesLeft = Math.round((secondsLeft % 3600) / 60);
    if (hoursLeft <= 0) {
      return `${minutesLeft} min`;
    }
    if (minutesLeft <= 0) {
      return `${hoursLeft}h`;
    }
    return `${hoursLeft}h ${minutesLeft}m`;
  } catch {
    return '';
  }
}

/** User-facing explanation when cloud AI failed — never pretend local parsing understood the prompt. */
export function geminiUnavailableExplanation(reason: GeminiOutageReason): string {
  switch (reason) {
    case 'quota':
      if (lastQuotaScope === 'day') {
        const eta = timeUntilPacificResetLabel();
        const resetLine = eta
          ? `It resets at midnight US Pacific — about ${eta} from now.`
          : 'It resets at midnight US Pacific time.';
        return (
          "Cloud AI (Gemini) has reached today's free daily usage limit. " +
          `${resetLine} You can keep using the manual controls — the AI guide will work again after it resets. ` +
          'Nothing was changed from your message.'
        );
      }
      return (
        'Cloud AI (Gemini) hit the free-tier per-minute rate limit. ' +
        'Wait about a minute without sending prompts, then try again. Nothing was inferred from your message.'
      );
    case 'auth':
      return (
        'Cloud AI (Gemini) is unavailable — the API key is invalid or restricted. ' +
        'Nothing was inferred from your message. Update GEMINI_API_KEY in .env and rebuild.'
      );
    case 'no-key':
      return (
        'Cloud AI (Gemini) is unavailable — no API key is configured. ' +
        'Nothing was inferred from your message. Add GEMINI_API_KEY to .env and rebuild.'
      );
    case 'empty':
      return (
        'Cloud AI (Gemini) returned an unreadable response. Nothing was applied from your message — please try again.'
      );
    case 'server':
    case 'network':
    default:
      return (
        'Cloud AI (Gemini) did not respond in time — the free model may be busy. ' +
        'Wait a few seconds and try one prompt again. Nothing was inferred from your message.'
      );
  }
}

/**
 * Shared, compact reference blocks describing the real app surface. Kept terse
 * on purpose — exhaustive coverage without bloating every request's token cost.
 */
const BANDS_REF = `BANDS (beatHz → name; either name accepted, plus common synonyms):
<0.5 HEALING/Infra-slow · 0.5–4 DREAM/Delta · 4–8 MEDITATE/Theta · 8–12 CALM/Alpha · 12–15 FOCUS/Alpha-beta · 15–30 ENGAGED/Beta · 30–50 COGNITION/Gamma · 50–80 INSIGHT/High-gamma · 80–150 SYNTHESIS/Very-high-gamma · 150–280 INTEGRATION/Supra-gamma · 280–500 INFINITE/Omega · >500 EXPERIMENT (experimental mode only). Synonyms: epsilon/sub-delta→HEALING, SMR→FOCUS, lambda/hyper-gamma→INSIGHT/SYNTHESIS.`;

const ENGINES_REF = `ENGINE MODES (when to use · gating):
binaural (classic L/R beat · free · needs headphones) · monaural (pre-mixed pulse · free · speakers OK) · isochronic (on/off pulses, strong · free · speakers OK) · hemisphericSync (deep L/R coherence · premium · headphones) · phaseModulated (moving phase, dynamic · premium · headphones) · pitchPanning (pitch+pan motion · premium · headphones). musicModulation = coming soon, never select.`;

const RANGES_REF = `RANGES: beatHz free 0.5–40, premium 0.05–500. carrierHz/pitch 20–1500 (20–20000 only when experimental ON). intensity/volume 0–1. phase 0–360°. drift ±12 Hz (binaural only). balance −1..+1. noiseMix 0–1; noiseLayer none|white|pink|brown (one at a time).`;

export const AI_GUIDE_SYSTEM_PROMPT = `You are the in-app sound engineer and guide for a real-time binaural/entrainment app. Every value you return is applied to the LIVE engine instantly and shown in the UI — you are effectively operating the app for the user.

PRINCIPLES
- Assume the user knows nothing about the controls. Deduce intent from loose, vague, emotional, or metaphorical language — never require keywords.
- Comply with ANY explicit value the user states (exact/approx Hz, band, pitch, phase, drift, pan, noise, intensity, engine type) and set it precisely, as long as it is a valid combination.
- Map any desired state, feeling, phenomenon, or outcome — grounded or speculative (e.g. lucid dreaming, astral, manifestation, third-eye, DMT-like, "the god frequency") — to the closest configuration the app can produce. Never refuse for lack of evidence; choose a plausible setting and keep claims gentle ("supports", "associated with").
- Conversation is continuous: honor the latest message and treat follow-ups ("deeper", "gentler", "now for speakers", "+2 Hz") as adjustments to the CURRENT live settings shown in context.
- If the request is off-topic, briefly steer back to a sound or state the app can produce.
- Omit carrierHz unless the user explicitly asks to change pitch/carrier/tone — entrainment is targetFrequencyHz (beat), 0.05–500 Hz only, never kHz values.

OUTPUT — return ONLY this JSON object (no markdown, prose, or code fences):
{
  "brainwaveState": string,                 // band name matching targetFrequencyHz
  "targetFrequencyHz": number,              // entrainment beat in Hz
  "targetedBrainRegions": [1-3 strings],
  "entrainmentStyle": "Binaural"|"Isochronic"|"Monaural",
  "intensityScale": number,                 // 0–1 volume/intensity
  "explanationShort": string,               // ≤2 short sentences, plain text
  // OPTIONAL — include ONLY when the user implies them; omit any field to leave it unchanged:
  "engineMode": "binaural"|"monaural"|"isochronic"|"hemisphericSync"|"phaseModulated"|"pitchPanning",  // overrides entrainmentStyle
  "carrierHz": number,                      // pitch/tone
  "phaseAngle": number,                     // 0–360
  "leftDriftHz": number, "rightDriftHz": number,   // binaural only
  "balance": number,                        // −1..1 pan
  "noiseLayer": "none"|"white"|"pink"|"brown",
  "noiseMix": number                        // 0–1
}

${BANDS_REF}
${ENGINES_REF}
${RANGES_REF}

GATING: only choose engine modes / ranges allowed by the availability line in context. If the user wants a locked feature (premium mode, >40 Hz on free, >1500 Hz pitch without experimental), pick the best allowed alternative and note it in one short clause.
Timed multi-step journeys (ramps, "then", per-step times, total duration, fade-out) are built by the sequencer, not here — for non-timed asks return a single best target. Keep output minimal.`;

export const AI_FORMULA_SYSTEM_PROMPT = `You are the in-app math engine for a real-time binaural/entrainment app. Your formula's result becomes the LIVE target the user hears.

PRINCIPLES
- Assume no prior knowledge; deduce intent from loose/metaphorical language without needing keywords.
- Comply with any explicit Hz the user gives — return it as a literal numeric formula (e.g. "7.83", "100").
- Map any state/phenomenon/outcome (real or speculative) to a plausible target; never refuse for lack of evidence.
- Conversation is continuous; follow-ups ("slower", "+3", "double", "an octave up") adjust relative to the live f_beat. Latest message wins.
- Single target only — timed multi-step journeys are handled elsewhere.
- Off-topic: steer gently back to a frequency or state the app can produce.

OUTPUT — return ONLY this JSON object (no markdown, prose, or code fences):
{ "reply": string (≤2 short sentences), "formula": string }
The formula may use f_L, f_R, f_beat, f_c, φ (golden ratio), π, sqrt(), **, |x| and numbers; it must evaluate to the target Hz.

${BANDS_REF}
${RANGES_REF}
Beat targets are normally 0.05–500 Hz; values above the beat range are applied as carrier/pitch when allowed. Keep output minimal.`;

export const AI_PROTOCOL_SYSTEM_PROMPT = `You are the in-app sequencer for a real-time binaural/entrainment app. You design multi-step "journeys" that play live; each step glides continuously from startBeatHz→endBeatHz across its durationSec.

PRINCIPLES
- Assume no prior knowledge; deduce structure from loose language.
- Comply exactly with any explicit values (Hz, duration, curve, engine, gain).
- Map any state/phenomenon/outcome to plausible band targets; never refuse.
- Conversation is continuous; the latest message wins on conflicts.

CRITICAL FIELD RULES (violations cause bad audio — never break these)
- beatHz / startBeatHz / endBeatHz = ENTRAINMENT frequency, 0.05–500 Hz ONLY. NEVER use kHz/MHz values in these fields. NEVER simulate "10 kHz" as a 500 Hz hold.
- If the user says "kHz" or "MHz", they mean CARRIER PITCH (audible tone, 20–20000 Hz) — that is NOT a beat field. Respond with beat steps in Hz range only, or a single sensible beat target — do NOT put kHz numbers into beat fields.
- carrierHz/pitch is a SEPARATE audio field (20–1500 Hz) that does NOT appear in steps JSON.
- A hold (startBeatHz = endBeatHz) is ONLY correct when user says "hold at X" or "stay at X Hz". Any directional word (up, down, sweep, ramp, rise, fall, ascend, descend, scale, wind down, build up, go from X to Y) REQUIRES startBeatHz ≠ endBeatHz.
- "up then down" / "back and forth" / "round trip" / "arc" → MINIMUM 2 steps: one ascending (start < end), one descending (start > end). NEVER collapse to a single step.
- "full sequence / full sweep / full range / comprehensive" → MULTIPLE steps across a meaningful Hz range, NOT a single hold.

STATE→Hz MAPPING
- intense / high-energy / peak / alert / sharp / gamma → 30–50 Hz
- energetic / active / beta / focused / work → 15–30 Hz
- calm / relax / alpha / present / aware → 8–12 Hz
- meditative / drowsy / theta / creative / twilight → 4–8 Hz
- sleep / delta / dream / rest / unconscious → 0.5–4 Hz
- healing / infra / epsilon / sub-delta → <0.5 Hz

DIRECTIONAL RULES
- "start at X, go to Y" / "sweep from X to Y" → startBeatHz=Hz(X), endBeatHz=Hz(Y), must differ.
- "up then down": step 1 startBeatHz<endBeatHz (ascending), step 2 startBeatHz>endBeatHz (descending).
- "down then up": step 1 descending, step 2 ascending. Chain: endBeatHz[N] = startBeatHz[N+1].

DURATION RULES
- durationSec always in seconds (min×60).
- "N minutes exactly" → steps+fade = N×60 sec (set fadeOut=0 if exact wording used).
- Total-only duration → distribute evenly across steps.
- curve: "logarithmic" for descents/sleep/calm; "linear" for ascents/ramps/cycling.

${BANDS_REF}
${ENGINES_REF}
beatHz free 0.5–40 Hz, premium 0.05–500 Hz (above 40 needs premium; app clamps). engineMode excludes musicModulation.

OUTPUT — return ONLY this JSON object (no markdown, prose, or code fences):
{
  "title": string,
  "description": string,
  "stopAfterPlayback": boolean,
  "fadeOutDurationSec": number,
  "fadeOutStartGain": number,
  "fadeOutEndGain": number,
  "steps": [
    {
      "id": string,
      "label": string,
      "durationSec": number,
      "startBeatHz": number,
      "endBeatHz": number,
      "curve": "linear"|"logarithmic",
      "engineMode": "binaural"|"isochronic"|"monaural"|"hemisphericSync"|"phaseModulated"|"pitchPanning",
      "startGain": number,
      "endGain": number
    }
  ]
}`;

/** Smaller prompt for free-tier — large protocol prompts trigger 503 overload more often. */
export const AI_PROTOCOL_SYSTEM_PROMPT_COMPACT = `Design multi-step binaural entrainment journeys. Each step glides startBeatHz→endBeatHz over durationSec (seconds).
Rules: beat fields 0.05–500 Hz ONLY (never kHz). Ramps/sweeps need startBeatHz≠endBeatHz. Round trips need ≥2 steps. Holds only when user says "hold/stay".
Bands: delta/sleep 0.5–4, theta 4–8, alpha 8–12, beta 15–30, gamma 30–50. Map feelings/states to bands. Latest user message wins.
Return ONLY JSON: {title, description, stopAfterPlayback, fadeOutDurationSec, fadeOutStartGain, fadeOutEndGain, steps:[{id,label,durationSec,startBeatHz,endBeatHz,curve:"linear"|"logarithmic",engineMode:"binaural"|"isochronic"|"monaural",startGain,endGain}]}`;

/** Compact availability clause so the model only suggests what's unlocked. */
function availabilityClause(session: GeminiSessionContext): string {
  const tier = session.premium ? 'premium (beat 0.05–500 Hz, all engine modes)' : 'free (beat 0.5–40 Hz, basic engines only)';
  const exp = session.experimental ? 'experimental ON (pitch 20–20000 Hz, EXPERIMENT band)' : 'experimental OFF (pitch 20–1500 Hz)';
  return `${tier}; ${exp}`;
}

export async function geminiGuideRecommendation(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext,
): Promise<unknown | null> {
  const sessionLine = `live: beat ${session.beatHz.toFixed(2)} Hz, carrier ${session.carrierHz.toFixed(1)} Hz, gain ${(session.gain * 100).toFixed(0)}%, engine ${session.engineType}. availability: ${availabilityClause(session)}`;
  return callGeminiJson(AI_GUIDE_SYSTEM_PROMPT, history, latestPrompt, sessionLine);
}

export async function geminiFormulaResponse(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext & {f_L: number; f_R: number; f_beat: number; f_c: number},
): Promise<unknown | null> {
  const sessionLine = `live: f_L=${session.f_L.toFixed(2)}, f_R=${session.f_R.toFixed(2)}, f_beat=${session.f_beat.toFixed(2)}, f_c=${session.f_c.toFixed(1)}, engine ${session.engineType}. availability: ${availabilityClause(session)}`;
  return callGeminiJson(AI_FORMULA_SYSTEM_PROMPT, history, latestPrompt, sessionLine, {
    temperature: 0.45,
  });
}

// ---------------------------------------------------------------------------
// Band table — mirrors BRAINWAVE_BANDS without importing from the UI layer.
// ---------------------------------------------------------------------------
const PROTOCOL_BANDS = [
  {label: 'HEALING',     scientific: 'Infra-slow',      minHz: 0,    maxHz: 0.5,  mid: 0.1},
  {label: 'DREAM',       scientific: 'Delta',            minHz: 0.5,  maxHz: 4,    mid: 2},
  {label: 'MEDITATE',    scientific: 'Theta',            minHz: 4,    maxHz: 8,    mid: 6},
  {label: 'CALM',        scientific: 'Alpha',            minHz: 8,    maxHz: 12,   mid: 10},
  {label: 'FOCUS',       scientific: 'Alpha-beta',       minHz: 12,   maxHz: 15,   mid: 13.5},
  {label: 'ENGAGED',     scientific: 'Beta',             minHz: 15,   maxHz: 30,   mid: 22},
  {label: 'COGNITION',   scientific: 'Gamma',            minHz: 30,   maxHz: 50,   mid: 40},
  {label: 'INSIGHT',     scientific: 'High-gamma',       minHz: 50,   maxHz: 80,   mid: 65},
  {label: 'SYNTHESIS',   scientific: 'Very-high-gamma',  minHz: 80,   maxHz: 150,  mid: 115},
  {label: 'INTEGRATION', scientific: 'Supra-gamma',      minHz: 150,  maxHz: 280,  mid: 215},
  {label: 'INFINITE',    scientific: 'Omega',            minHz: 280,  maxHz: 500,  mid: 390},
  {label: 'EXPERIMENT',  scientific: 'Experimental',     minHz: 500,  maxHz: 1000, mid: 750},
] as const;

/** Map an intensity/mood/state phrase to an exact beatHz value, tier-aware. */
function resolveStateToHz(text: string, maxHz: number, minHz: number): number | null {
  const t = text.toLowerCase();
  // Explicit extremes first
  if (/\b(most[\s-]intense|highest[\s-]?(available|freq)?|maximum[\s-]?freq|top[\s-]?freq)\b/.test(t)) return maxHz;
  if (/\b(lowest[\s-]?(available|freq)?|minimum[\s-]?freq|bottom[\s-]?freq|lowest)\b/.test(t)) return minHz;
  if (/\bhighest\b/.test(t)) return maxHz;
  // Explicit Hz literal (e.g. "40hz", "10 hz") — parse before named states
  const litM = t.match(/\b(\d+(?:\.\d+)?)\s*hz\b/);
  if (litM) {
    const v = parseFloat(litM[1]);
    if (isFinite(v) && v > 0) return Math.min(Math.max(v, minHz), maxHz);
  }
  // Named bands (specific — checked before general high/low/middle anchors)
  if (/\b(intense|high[\s-]energy|peak|cognition|gamma)\b/.test(t)) return Math.min(40, maxHz);
  if (/\b(alert|focused|work|beta|energetic|active|engaged)\b/.test(t)) return Math.min(22, maxHz);
  if (/\b(focus|smr|alpha[\s-]beta)\b/.test(t)) return Math.min(13, maxHz);
  if (/\b(calm|relax(?:ed)?|alpha|present|aware)\b/.test(t)) return Math.min(10, maxHz);
  if (/\b(meditat\w*|drowsy|creative|theta|twilight|hypnagogic)\b/.test(t)) return Math.min(6, maxHz);
  if (/\b(sleep|delta|dream|deep[\s-]sleep|rest|unconscious)\b/.test(t)) return Math.max(2, minHz);
  if (/\b(heal\w*|infra|sub[\s-]delta|epsilon)\b/.test(t)) return Math.max(0.1, minHz);
  // General anchors — broad words used only as last resort
  if (/\bhigh(est)?\b/.test(t)) return maxHz;
  if (/\b(low(est)?|bottom)\b/.test(t)) return minHz;
  if (/\b(middle|mid(?:point)?|center|central|moderate|medium)\b/.test(t)) return Math.min(Math.max((maxHz + minHz) / 2, 10), maxHz);
  return null;
}

/**
 * Pre-resolve vague intent to exact Hz values before sending to Gemini.
 * Returns a "RESOLVED CONTEXT" block that is injected into the system instruction
 * so Gemini formats JSON rather than having to infer Hz from language.
 */
function buildProtocolHints(conversationText: string, session: GeminiSessionContext): string {
  const maxHz = session.experimental ? 1000 : session.premium ? 500 : 40;
  const minHz = session.premium ? 0.05 : 0.5;

  // Bands accessible at this tier (skip degenerate bands with no traversable range)
  const applicable = (PROTOCOL_BANDS as readonly (typeof PROTOCOL_BANDS)[number][]).filter(b => {
    const capMax = Math.min(b.maxHz, maxHz);
    const capMin = Math.max(b.minHz, minHz);
    return capMax > capMin && (session.experimental || b.label !== 'EXPERIMENT');
  });

  // Does the user want a sweep through every band?
  const allBands =
    /\b(each|every|all)\s+(?:(?:freq(?:uency)?|beat)\s+)?band/i.test(conversationText) ||
    /\bthrough\s+(?:each\s+|every\s+|all\s+)?(?:(?:freq(?:uency)?|beat)\s+)?band/i.test(conversationText) ||
    /\ball\s+(?:(?:freq(?:uency)?|beat)\s+)?(?:range|zone|level)s?/i.test(conversationText) ||
    /\bfull\s+(?:sweep|scan|range|spectrum)\b/i.test(conversationText);

  // Round-trip / arc detection
  const isRoundTrip =
    /\b(up\s+(?:and|then)\s+down|down\s+(?:and|then)\s+up)\b/i.test(conversationText) ||
    /\b(rise\s+(?:and|then)\s+fall|ascend\s+(?:and|then)\s+descend)\b/i.test(conversationText) ||
    /\b(back\s+(?:and\s+forth|again)|round[\s-]trip|there\s+and\s+back)\b/i.test(conversationText);

  const ascendFirst =
    !isRoundTrip ||
    /\b(up\s+(?:and|then)\s+down|rise\s+(?:and|then)\s+fall)\b/i.test(conversationText) ||
    !(/\b(down\s+(?:and|then)\s+up|fall\s+(?:and|then)\s+rise)\b/i.test(conversationText));

  const goingDown =
    !isRoundTrip &&
    /\b(down|descend|drop|fall|lower|lowest|sleep|calm|reduce|wind[\s-]down|scale[\s-]down|ramp[\s-]down)\b/i.test(
      conversationText,
    );

  // Infer total duration from text
  const durationMatch = conversationText.match(/(\d+(?:\.\d+)?)\s*(min(?:utes?)?|sec(?:onds?)?|hour?s?)/i);
  const durationSec = durationMatch
    ? /hour/i.test(durationMatch[2])
      ? parseFloat(durationMatch[1]) * 3600
      : /sec/i.test(durationMatch[2])
      ? parseFloat(durationMatch[1])
      : parseFloat(durationMatch[1]) * 60
    : null;

  const lines: string[] = [
    '[RESOLVED CONTEXT — copy these exact values into JSON output, do not override them]',
    `Tier: ${session.premium ? 'premium' : 'free'} | beatHz range ${minHz}–${maxHz}`,
  ];

  if (allBands) {
    const ordered = goingDown ? [...applicable].reverse() : applicable;
    lines.push(
      `All-band ${goingDown ? 'descending' : 'ascending'} sweep — generate exactly ${ordered.length} steps:`,
    );
    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      const capMax = Math.min(b.maxHz, maxHz);
      const capMin = Math.max(b.minHz, minHz);
      const [s, e] = goingDown ? [capMax, capMin] : [capMin, capMax];
      lines.push(
        `  ${i + 1}. ${b.label}/${b.scientific}: startBeatHz=${+s.toFixed(3)}, endBeatHz=${+e.toFixed(3)}`,
      );
    }
    lines.push(
      `Divide total durationSec evenly: each step = totalSec/${ordered.length}. curve=logarithmic throughout.`,
    );
  } else if (isRoundTrip) {
    // --- Multi-waypoint branch: inject before simple arc ---
    // If the conversation has 3+ distinct waypoints (e.g. "low → high → focus"),
    // resolve them to exact Hz and inject as explicit steps.
    const BOUNDARY_RE =
      /\s+(?:then\s+back\s+to|then\s+back|then\s+(?:go\s+)?(?:to|down\s+to|up\s+to)?|and\s+then|→|followed\s+by|after\s+that|,\s*then)\s*/i;
    const segs = conversationText.split(BOUNDARY_RE).filter(s => s.trim().length > 0);
    const waypointsHz: number[] = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i].trim();
      if (i === 0) {
        const ft = seg.match(/(?:\bfrom\s+)?(?:the\s+)?(.{2,30}?)\s+to\s+(?:the\s+)?(.{2,30})$/i);
        if (ft) {
          const a = resolveStateToHz(ft[1], maxHz, minHz);
          const b2 = resolveStateToHz(ft[2], maxHz, minHz);
          if (a !== null) waypointsHz.push(a);
          if (b2 !== null && (waypointsHz.length === 0 || Math.abs(b2 - waypointsHz[waypointsHz.length - 1]) > 0.1)) waypointsHz.push(b2);
        } else {
          const hz = resolveStateToHz(seg, maxHz, minHz);
          if (hz !== null) waypointsHz.push(hz);
        }
      } else {
        const hz = resolveStateToHz(seg, maxHz, minHz);
        if (hz !== null) {
          const last = waypointsHz[waypointsHz.length - 1];
          if (last === undefined || Math.abs(hz - last) > 0.1) waypointsHz.push(hz);
        }
      }
    }
    if (waypointsHz.length >= 3) {
      const stepSec = durationSec != null ? durationSec / (waypointsHz.length - 1) : 60;
      lines.push(`Multi-waypoint journey — generate EXACTLY ${waypointsHz.length - 1} steps:`);
      waypointsHz.slice(0, -1).forEach((startBeatHz, i) => {
        const endBeatHz = waypointsHz[i + 1];
        lines.push(`  Step ${i + 1}: startBeatHz=${+startBeatHz.toFixed(3)}, endBeatHz=${+endBeatHz.toFixed(3)}, durationSec=${stepSec.toFixed(1)}, curve=${endBeatHz < startBeatHz ? 'logarithmic' : 'linear'}`);
      });
      if (durationSec != null) lines.push(`Total = ${durationSec} sec. Do NOT add extra steps.`);
    } else {
      // Fall through to simple round-trip arc
      const halfSec = durationSec != null ? durationSec / 2 : 60;
      if (ascendFirst) {
        lines.push(`Round-trip arc (ascending first) — EXACTLY 2 steps:`);
        lines.push(`  Step 1 (ascending): startBeatHz=${minHz}, endBeatHz=${maxHz}, durationSec=${halfSec}, curve=linear`);
        lines.push(`  Step 2 (descending): startBeatHz=${maxHz}, endBeatHz=${minHz}, durationSec=${halfSec}, curve=logarithmic`);
      } else {
        lines.push(`Round-trip arc (descending first) — EXACTLY 2 steps:`);
        lines.push(`  Step 1 (descending): startBeatHz=${maxHz}, endBeatHz=${minHz}, durationSec=${halfSec}, curve=logarithmic`);
        lines.push(`  Step 2 (ascending): startBeatHz=${minHz}, endBeatHz=${maxHz}, durationSec=${halfSec}, curve=linear`);
      }
      if (durationSec != null) lines.push(`Total = ${durationSec} sec. Do NOT add fade-out beyond this.`);
    }
  } else {
    // Try to resolve start and end states from language
    const startMatch = conversationText.match(
      /(?:start(?:ing)?\s+(?:at\s+)?|begin(?:ning)?\s+(?:at\s+)?|from\s+(?:the\s+)?)(.{3,50?}?)(?:\s+and\b|\s+(?:then|drop|ramp|go|scale|descend|fall)\b|,|\s*$)/i,
    );
    const endMatch = conversationText.match(
      /(?:(?:drop|go|scale|ramp|fade|descend|fall|wind|transition)\w*\s+(?:down\s+)?to|end\s+(?:at\s+)?|down\s+to|to\s+(?:a\s+|the\s+)?)(.{3,50?}?)(?:\s+over\b|\s+in\b|\s+for\b|\s+going\b|,|\s*$)/i,
    );

    const resolvedStart = resolveStateToHz(startMatch?.[1] ?? conversationText, maxHz, minHz);
    const resolvedEnd = resolveStateToHz(endMatch?.[1] ?? '', maxHz, minHz);

    // Also scan whole text for "highest"/"lowest" anchors if regex didn't resolve
    const anchorMax = /\b(highest|most[\s-]intense|max(imum)?)\b/i.test(conversationText) ? maxHz : null;
    const anchorMin = /\b(lowest|minimum|least[\s-]intense)\b/i.test(conversationText) ? minHz : null;

    const start = resolvedStart ?? anchorMax;
    const end = resolvedEnd ?? anchorMin;

    if (start !== null) lines.push(`startBeatHz=${+start.toFixed(3)}`);
    if (end !== null && end !== start) lines.push(`endBeatHz=${+end.toFixed(3)}`);

    if (start !== null && end !== null && start !== end) {
      const curve = end < start ? 'logarithmic' : 'linear';
      lines.push(
        `SWEEP (not a hold): startBeatHz=${+start.toFixed(3)}, endBeatHz=${+end.toFixed(3)}, curve=${curve}.`,
      );
      lines.push('startBeatHz MUST NOT equal endBeatHz in the output JSON.');
    } else if (start !== null && end === null && goingDown) {
      lines.push(`SWEEP DOWN: startBeatHz=${+start.toFixed(3)}, endBeatHz=${+minHz.toFixed(3)}, curve=logarithmic.`);
    }
  }

  lines.push('[END RESOLVED CONTEXT]');
  return '\n\n' + lines.join('\n');
}

export async function geminiProtocolSequence(
  history: ChatTurn[],
  latestPrompt: string,
  session: GeminiSessionContext,
  options: {repair?: boolean; compact?: boolean} = {},
): Promise<unknown | null> {
  const sessionLine = `live: beat ${session.beatHz.toFixed(2)} Hz, gain ${(session.gain * 100).toFixed(0)}%, engine ${session.engineType}. availability: ${availabilityClause(session)}`;
  const userBrief = buildUserConversationText(history, latestPrompt);
  const useCompact = options.compact ?? !options.repair;
  const hintsBlock = useCompact ? '' : buildProtocolHints(userBrief, session);
  const basePrompt = useCompact ? AI_PROTOCOL_SYSTEM_PROMPT_COMPACT : AI_PROTOCOL_SYSTEM_PROMPT;
  const systemPrompt = `${basePrompt}${hintsBlock}`;

  const repairSuffix = options.repair
    ? 'Your prior JSON was invalid or ignored the user. Return ONLY a JSON object with a "steps" array. Each step MUST have startBeatHz, endBeatHz, durationSec (seconds). Beat fields 0.05–500 Hz only — never kHz. Match the user journey exactly.'
    : 'Return ONLY valid JSON matching the schema (object with "steps" array). beatHz fields are 0.05–500 Hz entrainment — NEVER 1000+ or kHz magnitudes. Each step needs startBeatHz, endBeatHz, durationSec. Honor explicit timings and multi-step structure from the user.';

  return callGeminiJson(systemPrompt, history, latestPrompt, sessionLine, {
    temperature: options.repair ? 0.2 : 0.35,
    maxOutputTokens: useCompact ? 768 : 1024,
    systemSuffix: repairSuffix,
  });
}
