import type {ChatTurn} from './aiPromptParsing';
import type {EngineMode} from '../state/types';
import {normalizeProtocol} from '../protocol/interpolateProtocol';
import type {ProtocolStep, RampCurve, SessionProtocol} from '../protocol/types';

const HZ = /(\d+(?:\.\d+)?)\s*(?:hz|hertz)\b/gi;

const STEP_SPLIT =
  /\s+(?:then|→|->|,\s*then|;\s*|\bstep\s+\d+\s*:?\s*|\bphase\s+\d+\s*:?\s*|\bstage\s+\d+\s*:?\s*)/i;

const FUZZY_DURATIONS: {re: RegExp; sec: number}[] = [
  {re: /\ba\s+few\s+(?:seconds?|secs?)\b/i, sec: 30},
  {re: /\ba\s+couple\s+(?:of\s+)?(?:seconds?|secs?)\b/i, sec: 20},
  {re: /\ba\s+few\s+(?:minutes?|mins?)\b/i, sec: 3 * 60},
  {re: /\ba\s+couple\s+(?:of\s+)?(?:minutes?|mins?)\b/i, sec: 2 * 60},
  {re: /\bseveral\s+(?:minutes?|mins?)\b/i, sec: 5 * 60},
  {re: /\bhalf\s+(?:an?\s+)?hour\b/i, sec: 30 * 60},
  {re: /\bquarter\s+(?:of\s+(?:an?\s+)?)?hour\b/i, sec: 15 * 60},
  {re: /\b(?:an?\s+)?hour\s+and\s+a\s+half\b/i, sec: 90 * 60},
  {re: /\ba\s+few\s+(?:hours?|hrs?)\b/i, sec: 3 * 3600},
  {re: /\bseveral\s+(?:hours?|hrs?)\b/i, sec: 4 * 3600},
];

function clampHz(hz: number): number {
  return Math.max(0.5, Math.min(500, hz));
}

export function normalizeConversationForParsing(text: string): string {
  return text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Chronological user-only text from chat history + latest message. */
export function buildUserConversationText(history: ChatTurn[], latest: string): string {
  const userLines = history
    .filter(t => t.role === 'user')
    .map(t => t.text.trim())
    .filter(Boolean);
  const tail = latest.trim();
  if (tail && (userLines.length === 0 || userLines[userLines.length - 1] !== tail)) {
    userLines.push(tail);
  }
  return userLines.join('\n');
}

function parseDurationSecFromMatch(value: number, unit: 'min' | 'sec' | 'hour'): number {
  if (unit === 'hour') {
    return Math.max(1, Math.round(value * 3600));
  }
  if (unit === 'min') {
    return Math.max(1, Math.round(value * 60));
  }
  return Math.max(1, Math.round(value));
}

function collectFuzzyDurationSec(text: string): number | null {
  for (const {re, sec} of FUZZY_DURATIONS) {
    if (re.test(text)) {
      return sec;
    }
  }
  return null;
}

function parseDurationSec(chunk: string): number | null {
  const hourMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr\b)/i);
  if (hourMatch != null) {
    return parseDurationSecFromMatch(parseFloat(hourMatch[1]), 'hour');
  }
  const minMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min\b)/i);
  if (minMatch != null) {
    return parseDurationSecFromMatch(parseFloat(minMatch[1]), 'min');
  }
  const secMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec\b)/i);
  if (secMatch != null) {
    return parseDurationSecFromMatch(parseFloat(secMatch[1]), 'sec');
  }
  const bareMin = chunk.match(/\bfor\s+(\d+(?:\.\d+)?)\s*m\b/i);
  if (bareMin != null) {
    return parseDurationSecFromMatch(parseFloat(bareMin[1]), 'min');
  }
  return collectFuzzyDurationSec(chunk);
}

/** Collect every duration mention in prompt order (minutes, hours, seconds). */
export function collectDurationSecMentions(prompt: string): number[] {
  const out: number[] = [];
  const pattern =
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr\b|minutes?|mins?|min\b|seconds?|secs?|sec\b)/gi;
  for (const m of prompt.matchAll(pattern)) {
    const value = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    if (unit.startsWith('h') || unit === 'hr') {
      out.push(parseDurationSecFromMatch(value, 'hour'));
    } else if (unit.startsWith('sec') || unit === 'sec' || unit === 'secs') {
      out.push(parseDurationSecFromMatch(value, 'sec'));
    } else {
      out.push(parseDurationSecFromMatch(value, 'min'));
    }
  }
  if (out.length === 0) {
    const fuzzy = collectFuzzyDurationSec(prompt);
    if (fuzzy != null) {
      out.push(fuzzy);
    }
  }
  return out;
}

/**
 * Infer the total journey length the user asked for in one text blob.
 * Multi-step prompts sum per-step durations; single-total prompts use that value.
 */
export function inferTargetTotalSecFromPrompt(prompt: string): number | null {
  const normalized = normalizeConversationForParsing(prompt);
  const durations = collectDurationSecMentions(normalized);
  if (durations.length === 0) {
    return null;
  }

  const multiStep =
    /\b(then|→|->|,\s*then|;\s*|\bstep\s+\d|\bphase\s+\d|\bstage\s+\d)\b/i.test(normalized) &&
    durations.length >= 2;

  if (multiStep) {
    return durations.reduce((sum, sec) => sum + sec, 0);
  }

  if (durations.length === 1) {
    return durations[0];
  }

  if (
    /\b\d+(?:\.\d+)?\s*(?:minutes?|mins?|min\b|hours?|hrs?|seconds?|secs?)\s+(?:sleep|focus|calm|sequence|protocol|journey|session|program)\b/i.test(
      normalized,
    )
  ) {
    return durations[0];
  }

  if (/\b(?:over|for|lasting|about|around|total(?:\s+of)?|entire|whole|only)\s+\d/i.test(normalized)) {
    return durations[0];
  }

  return durations.reduce((sum, sec) => sum + sec, 0);
}

/**
 * Duration intent from full user conversation — newest user turn with a duration wins,
 * then combined multi-turn text for chained step specs.
 */
export function inferTargetTotalSecFromConversation(
  history: ChatTurn[],
  latest: string,
): number | null {
  const userTurns = buildUserConversationText(history, latest)
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean);

  for (let i = userTurns.length - 1; i >= 0; i -= 1) {
    const fromTurn = inferTargetTotalSecFromPrompt(userTurns[i]);
    if (fromTurn != null) {
      return fromTurn;
    }
  }

  return inferTargetTotalSecFromPrompt(normalizeConversationForParsing(userTurns.join(' ')));
}

export function extractTargetHzFromConversationText(text: string): number | null {
  const normalized = normalizeConversationForParsing(text);
  const patterns = [
    /\b(\d+(?:\.\d+)?)\s*(?:hz|hertz)\b/gi,
    /\bat\s+(\d+(?:\.\d+)?)\b/gi,
    /\b(?:frequency|freq|beat|target|set(?:\s+it)?\s+to|use|apply|try|want|need)\s*(?:of|at|to)?\s*(\d+(?:\.\d+)?)\b/gi,
  ];
  let lastHz: number | null = null;
  for (const re of patterns) {
    for (const m of normalized.matchAll(re)) {
      const hz = parseFloat(m[1]);
      if (Number.isFinite(hz) && hz > 0) {
        lastHz = clampHz(hz);
      }
    }
  }
  return lastHz;
}

export function extractTargetHzFromConversation(history: ChatTurn[], latest: string): number | null {
  const userTurns = buildUserConversationText(history, latest)
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean);
  for (let i = userTurns.length - 1; i >= 0; i -= 1) {
    const hz = extractTargetHzFromConversationText(userTurns[i]);
    if (hz != null) {
      return hz;
    }
  }
  return extractTargetHzFromConversationText(userTurns.join(' '));
}

function parseHzValues(chunk: string): number[] {
  const values: number[] = [];
  for (const m of chunk.matchAll(HZ)) {
    const n = parseFloat(m[1]);
    if (Number.isFinite(n) && n > 0) {
      values.push(clampHz(n));
    }
  }
  if (values.length === 0) {
    const bare = chunk.match(/\bat\s+(\d+(?:\.\d+)?)\b/i);
    if (bare != null) {
      values.push(clampHz(parseFloat(bare[1])));
    }
  }
  return values;
}

function parseGlide(chunk: string): {start: number; end: number; curve: RampCurve} | null {
  const ramp =
    chunk.match(
      /(?:from|start(?:ing)?\s+(?:at)?)\s*(\d+(?:\.\d+)?)\s*(?:hz|hertz)?\s*(?:to|→|->|down\s+to|up\s+to|into)\s*(\d+(?:\.\d+)?)/i,
    ) ??
    chunk.match(
      /(\d+(?:\.\d+)?)\s*(?:hz|hertz)?\s*(?:to|→|->)\s*(\d+(?:\.\d+)?)\s*(?:hz|hertz)?/i,
    ) ??
    chunk.match(/ramp(?:ing)?\s+(?:from\s+)?(\d+(?:\.\d+)?)\s*(?:to|→|->)\s*(\d+(?:\.\d+)?)/i);

  if (ramp != null) {
    const start = clampHz(parseFloat(ramp[1]));
    const end = clampHz(parseFloat(ramp[2]));
    const curve: RampCurve = /log|smooth|gradual/i.test(chunk) ? 'logarithmic' : 'linear';
    return {start, end, curve};
  }
  return null;
}

function stepLabel(hz: number, endHz?: number): string {
  if (endHz != null && Math.abs(endHz - hz) >= 0.05) {
    return `${hz}→${endHz} Hz`;
  }
  return `${hz} Hz`;
}

function buildStep(
  partial: {
    durationSec: number;
    startBeatHz: number;
    endBeatHz: number;
    curve?: RampCurve;
    label?: string;
  },
  engine: EngineMode,
  index: number,
): ProtocolStep {
  return {
    id: `parsed-${index}`,
    label: partial.label ?? stepLabel(partial.startBeatHz, partial.endBeatHz),
    durationSec: partial.durationSec,
    startBeatHz: partial.startBeatHz,
    endBeatHz: partial.endBeatHz,
    curve: partial.curve ?? (partial.startBeatHz !== partial.endBeatHz ? 'logarithmic' : 'linear'),
    startGain: 0.42,
    endGain: 0.38,
    engineMode: engine,
  };
}

function parseStepChunk(chunk: string, carryHz: number, engine: EngineMode, index: number): ProtocolStep | null {
  const trimmed = chunk.trim();
  if (!trimmed) {
    return null;
  }

  const durationSec = parseDurationSec(trimmed);
  const glide = parseGlide(trimmed);
  const hzValues = parseHzValues(trimmed);

  if (durationSec == null) {
    return null;
  }

  if (glide != null) {
    return buildStep(
      {
        durationSec,
        startBeatHz: glide.start,
        endBeatHz: glide.end,
        curve: glide.curve,
      },
      engine,
      index,
    );
  }

  if (hzValues.length >= 2) {
    return buildStep(
      {
        durationSec,
        startBeatHz: hzValues[0],
        endBeatHz: hzValues[1],
        curve: hzValues[0] !== hzValues[1] ? 'logarithmic' : 'linear',
      },
      engine,
      index,
    );
  }

  if (hzValues.length === 1) {
    const hz = hzValues[0];
    return buildStep(
      {
        durationSec,
        startBeatHz: carryHz > 0 ? carryHz : hz,
        endBeatHz: hz,
        curve: carryHz > 0 && carryHz !== hz ? 'logarithmic' : 'linear',
      },
      engine,
      index,
    );
  }

  if (carryHz > 0) {
    return buildStep(
      {durationSec, startBeatHz: carryHz, endBeatHz: carryHz, curve: 'linear'},
      engine,
      index,
    );
  }

  return null;
}

/** True when text contains concrete timing and/or Hz values worth parsing locally. */
export function promptHasExplicitSequenceNumbers(prompt: string): boolean {
  const normalized = normalizeConversationForParsing(prompt);
  return (
    collectDurationSecMentions(normalized).length > 0 ||
    /(\d+(?:\.\d+)?)\s*(?:hz|hertz)\b/i.test(normalized) ||
    /\bat\s+\d+(?:\.\d+)?\b/i.test(normalized) ||
    /\d+\s*(?:to|→|->)\s*\d+/i.test(normalized) ||
    FUZZY_DURATIONS.some(f => f.re.test(normalized))
  );
}

function parseExplicitProtocolFromText(prompt: string, engine: EngineMode): SessionProtocol | null {
  const normalized = normalizeConversationForParsing(prompt);
  const chunks = normalized
    .split(STEP_SPLIT)
    .map(c => c.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return null;
  }

  const steps: ProtocolStep[] = [];
  let carryHz = 0;

  for (let i = 0; i < chunks.length; i++) {
    const step = parseStepChunk(chunks[i], carryHz, engine, i);
    if (step != null) {
      steps.push(step);
      carryHz = step.endBeatHz;
    }
  }

  if (steps.length > 0) {
    const titleMatch = normalized.match(
      /(?:create|build|make|design)\s+(?:a\s+)?(.{0,48}?)(?:\s+sequence|\s+protocol|\s+journey|$)/i,
    );
    const title = titleMatch?.[1]?.trim() || 'Custom Sequence';
    return mergeFadeOut(normalized, {
      id: `ai-parsed-${Date.now()}`,
      title: title.length > 2 ? title : 'Custom Sequence',
      description: 'Built from your explicit timings and frequencies.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: steps[steps.length - 1]?.endGain ?? 0.35,
      fadeOutEndGain: 0.04,
      steps,
    });
  }

  const totalSec = inferTargetTotalSecFromPrompt(normalized);
  const hz = extractTargetHzFromConversationText(normalized);
  if (totalSec != null && hz != null) {
    return mergeFadeOut(normalized, {
      id: `ai-parsed-${Date.now()}`,
      title: 'Custom Sequence',
      description: 'Built from your requested duration and frequency.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: 0.35,
      fadeOutEndGain: 0.04,
      steps: [buildStep({durationSec: totalSec, startBeatHz: hz, endBeatHz: hz, curve: 'linear'}, engine, 0)],
    });
  }

  if (totalSec != null) {
    return mergeFadeOut(normalized, {
      id: `ai-parsed-${Date.now()}`,
      title: 'Custom Sequence',
      description: 'Built from your requested duration.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: 0.35,
      fadeOutEndGain: 0.04,
      steps: [
        buildStep(
          {durationSec: totalSec, startBeatHz: 10, endBeatHz: 10, curve: 'linear', label: 'Hold · 10 Hz'},
          engine,
          0,
        ),
      ],
    });
  }

  return null;
}

/**
 * Parse explicit step durations and Hz from natural language (single message).
 */
export function parseExplicitProtocolFromPrompt(
  prompt: string,
  engine: EngineMode,
): SessionProtocol | null {
  return parseExplicitProtocolFromText(prompt, engine);
}

/** Parse user constraints accumulated across the whole chat. */
export function parseExplicitProtocolFromConversation(
  history: ChatTurn[],
  latest: string,
  engine: EngineMode,
): SessionProtocol | null {
  const userText = buildUserConversationText(history, latest);
  const fromCombined = parseExplicitProtocolFromText(userText, engine);
  if (fromCombined != null) {
    return fromCombined;
  }
  return parseExplicitProtocolFromText(normalizeConversationForParsing(userText.replace(/\n/g, ' then ')), engine);
}

export function conversationHasExplicitSequenceNumbers(history: ChatTurn[], latest: string): boolean {
  return promptHasExplicitSequenceNumbers(buildUserConversationText(history, latest));
}

export type ProtocolFadeOutPatch = Pick<
  SessionProtocol,
  'fadeOutDurationSec' | 'fadeOutStartGain' | 'fadeOutEndGain'
>;

function durationSecFromMatch(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h') || u === 'hr') {
    return Math.max(1, Math.round(value * 3600));
  }
  if (u.startsWith('sec') || u === 'sec' || u === 'secs') {
    return Math.max(1, Math.round(value));
  }
  return Math.max(1, Math.round(value * 60));
}

/** Parse end fade duration and volume range from natural language. */
export function parseFadeOutFromText(text: string): Partial<ProtocolFadeOutPatch> | null {
  const normalized = normalizeConversationForParsing(text);
  const patch: Partial<ProtocolFadeOutPatch> = {};
  let found = false;

  const fadeDur =
    normalized.match(
      /fade(?:\s+out)?\s+(?:over|in|for|within)\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec\b|minutes?|mins?|min\b|hours?|hrs?|hr\b)/i,
    ) ??
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(seconds?|secs?|sec\b|minutes?|mins?|min\b|hours?|hrs?|hr\b)\s+(?:end\s+)?fade(?:\s+out)?/i,
    ) ??
    normalized.match(
      /(?:gentle|slow|long)\s+(?:fade(?:\s+out)?(?:\s+(?:over|for))?\s+)?(\d+(?:\.\d+)?)\s*(minutes?|mins?|min\b|seconds?|secs?|sec\b|hours?|hrs?)/i,
    );

  if (fadeDur != null) {
    patch.fadeOutDurationSec = durationSecFromMatch(parseFloat(fadeDur[1]), fadeDur[2]);
    found = true;
  }

  const volRange =
    normalized.match(
      /fade(?:\s+out)?\s+from\s+(\d+(?:\.\d+)?)\s*(?:%|percent)?\s*(?:volume|vol)?\s*(?:to|→|->)\s*(\d+(?:\.\d+)?)\s*(?:%|percent)?/i,
    ) ??
    normalized.match(
      /(?:volume|vol)\s+(?:from\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)?\s*(?:to|→|->)\s*(\d+(?:\.\d+)?)\s*(?:%|percent)?(?:\s+(?:over|in|during)\s+fade)?/i,
    );

  if (volRange != null) {
    patch.fadeOutStartGain = parseFloat(volRange[1]) / 100;
    patch.fadeOutEndGain = parseFloat(volRange[2]) / 100;
    found = true;
  } else if (/fade/i.test(normalized)) {
    const looseVol = normalized.match(
      /from\s+(\d+(?:\.\d+)?)\s*(?:%|percent)?\s*(?:volume|vol)?\s*(?:to|→|->)\s*(\d+(?:\.\d+)?)\s*(?:%|percent)?/i,
    );
    if (looseVol != null) {
      patch.fadeOutStartGain = parseFloat(looseVol[1]) / 100;
      patch.fadeOutEndGain = parseFloat(looseVol[2]) / 100;
      found = true;
    }
  }

  if (/fade(?:\s+out)?\s+to\s+silence/i.test(normalized)) {
    patch.fadeOutEndGain = 0;
    found = true;
  }

  if (/no\s+fade(?:\s+out)?|without\s+fade(?:\s+out)?|instant\s+stop/i.test(normalized)) {
    patch.fadeOutDurationSec = 0;
    found = true;
  }

  return found ? patch : null;
}

/** Fade-out settings from conversation — newest user turn with fade detail wins. */
export function parseFadeOutFromConversation(
  history: ChatTurn[],
  latest: string,
): Partial<ProtocolFadeOutPatch> | null {
  const turns = buildUserConversationText(history, latest)
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const patch = parseFadeOutFromText(turns[i]);
    if (patch != null) {
      return patch;
    }
  }
  return parseFadeOutFromText(turns.join(' '));
}

function mergeFadeOut(text: string, protocol: SessionProtocol): SessionProtocol {
  const fade = parseFadeOutFromText(text);
  return normalizeProtocol(fade != null ? {...protocol, ...fade} : protocol);
}
