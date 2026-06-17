import type {EngineMode} from '../state/types';
import {getProtocolsForEngine} from '../protocol/builtinProtocols';
import {
  computeProtocolTotalSec,
  computeStepsTotalSec,
  normalizeProtocol,
  scaleProtocolStepsToTotalSec,
} from '../protocol/interpolateProtocol';
import type {ProtocolStep, RampCurve, SessionProtocol} from '../protocol/types';
import {geminiProtocolSequence, getGeminiOutageReason} from './geminiChatClient';
import {sanitizeBeatHzFromModel, parseCarrierHzFromPrompt} from './beatHzSanitize';
import type {ChatTurn} from './aiPromptParsing';
import {bandNameToHz} from './parseProtocolFromPrompt';
import {
  buildUserConversationText,
  buildIntentParsingText,
  isConversationContinuation,
  collectDurationSecMentions,
  parseNarrativeJourneyFromText,
  conversationHasExplicitSequenceNumbers,
  inferTargetTotalSecFromConversation,
  normalizeConversationForParsing,
  parseExplicitProtocolFromConversation,
  parseExplicitProtocolFromPrompt,
  parseFadeOutFromConversation,
  parseFadeOutFromText,
} from './parseProtocolFromPrompt';

import {wantsProtocolSequence, isSequenceRequest, isSequenceRequestInConversation} from './aiIntent';
import {
  buildExperientialProtocol,
  classifyExperientialIntent,
} from './experientialIntent';
export {isSequenceRequest, isSequenceRequestInConversation};

function makeStep(
  partial: Partial<ProtocolStep> &
    Pick<ProtocolStep, 'durationSec' | 'startBeatHz' | 'endBeatHz' | 'label'>,
  defaultEngine: EngineMode,
): ProtocolStep {
  return {
    id: partial.id ?? `step-${Math.random().toString(36).slice(2, 7)}`,
    label: partial.label,
    durationSec: partial.durationSec,
    startBeatHz: partial.startBeatHz,
    endBeatHz: partial.endBeatHz,
    curve: partial.curve ?? 'logarithmic',
    startGain: partial.startGain ?? 0.4,
    endGain: partial.endGain ?? partial.startGain ?? 0.4,
    engineMode: partial.engineMode ?? defaultEngine,
  };
}

function pickPreset(engine: EngineMode, matcher: (p: SessionProtocol) => boolean): SessionProtocol {
  const list = getProtocolsForEngine(engine);
  return JSON.parse(JSON.stringify(list.find(matcher) ?? list[0])) as SessionProtocol;
}

function localCalmSequence(engine: EngineMode): SessionProtocol {
  return normalizeProtocol({
    id: 'ai-calm-sequence',
    title: 'Calm Down Sequence',
    description: 'Gradual alpha→theta descent to settle racing thoughts.',
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: 30,
    fadeOutStartGain: 0.28,
    fadeOutEndGain: 0.04,
    steps: [
      makeStep({id: 'settle', label: 'Alpha · 10 Hz', durationSec: 8 * 60, startBeatHz: 12, endBeatHz: 10, startGain: 0.42, endGain: 0.38}, engine),
      makeStep({id: 'deep-calm', label: 'Theta · 6 Hz', durationSec: 12 * 60, startBeatHz: 10, endBeatHz: 6, startGain: 0.38, endGain: 0.32}, engine),
      makeStep({id: 'stillness', label: 'Theta · 4 Hz', durationSec: 5 * 60, startBeatHz: 6, endBeatHz: 4, startGain: 0.32, endGain: 0.28}, engine),
    ],
  });
}

function localGenericSequence(prompt: string, engine: EngineMode): SessionProtocol {
  const lower = prompt.toLowerCase();
  if (lower.includes('sleep') || lower.includes('bed') || lower.includes('night')) {
    return normalizeProtocol({
      ...pickPreset(engine, p => /sleep/i.test(p.title)),
      id: 'ai-sleep-sequence',
      title: 'Sleep Sequence',
    });
  }
  if (lower.includes('focus') || lower.includes('work') || lower.includes('study')) {
    return normalizeProtocol({
      ...pickPreset(engine, p => /focus|work|alert|deep work/i.test(p.title)),
      id: 'ai-focus-sequence',
      title: 'Focus Sequence',
    });
  }
  if (lower.includes('reset') || lower.includes('cycle') || lower.includes('swing')) {
    return normalizeProtocol({
      ...pickPreset(engine, p => /reset|neuro/i.test(p.title)),
      id: 'ai-reset-sequence',
      title: 'Neuro Reset Sequence',
    });
  }
  return localCalmSequence(engine);
}

function parseEngineMode(raw: unknown, fallback: EngineMode): EngineMode {
  const s = String(raw ?? fallback).toLowerCase();
  if (s.includes('hemi') || s.includes('sync')) {
    return 'hemisphericSync';
  }
  if (s.includes('phase')) {
    return 'phaseModulated';
  }
  if (s.includes('pan') || s.includes('spatial')) {
    return 'pitchPanning';
  }
  if (s.includes('iso')) {
    return 'isochronic';
  }
  if (s.includes('mona')) {
    return 'monaural';
  }
  if (s.includes('bina')) {
    return 'binaural';
  }
  return fallback;
}

function parseBeatHzField(raw: unknown, fallback?: number): number | null {
  const sanitized = sanitizeBeatHzFromModel(raw);
  if (sanitized != null) {
    return sanitized;
  }
  if (typeof raw === 'string') {
    const bandHz = bandNameToHz(raw.trim());
    if (bandHz != null) {
      return sanitizeBeatHzFromModel(bandHz);
    }
  }
  return fallback ?? null;
}

/** Coerce Gemini output into `{ steps: [...] }` — models often return a bare array. */
function unwrapGeminiProtocolPayload(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    return {
      title: 'Custom Sequence',
      description: 'AI-generated protocol',
      steps: raw,
    };
  }
  if (typeof raw !== 'object' || raw == null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.steps)) {
    return obj;
  }
  for (const key of ['protocol', 'sequence', 'journey', 'items'] as const) {
    const alt = obj[key];
    if (Array.isArray(alt)) {
      return {...obj, steps: alt};
    }
  }
  return null;
}

/** Reject Gemini "500 Hz hold labeled 10kHz" misparse. */
function protocolLooksLikeKhzMisparse(protocol: SessionProtocol, conversationText: string): boolean {
  if (!/\b\d+\s*khz\b/i.test(conversationText)) {
    return false;
  }
  return protocol.steps.some(step => {
    const label = step.label.toLowerCase();
    const isHold = Math.abs(step.startBeatHz - step.endBeatHz) < 0.05;
    return isHold && (label.includes('khz') || label.includes('10k') || step.startBeatHz >= 400);
  });
}

function conversationExpectsMultipleSteps(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(sequence|sweep|journey|protocol|multi[\s-]step|full\s+(?:sequence|sweep|range|spectrum))\b/.test(
      t,
    ) ||
    /\b(then|→|->|followed\s+by|and\s+then|after\s+that)\b/.test(t) ||
    /\b(up\s+(?:and|then|&)\s+down|down\s+(?:and|then|&)\s+up)\b/.test(t) ||
    /\b(back\s+again|round[\s-]trip|there\s+and\s+back|back\s+(?:and\s+forth|down|up))\b/.test(
      t,
    ) ||
    /\b(ramp|ascend|descend|rise|fall)\b.{1,80}\b(then|back|again|down|up)\b/.test(t)
  );
}

function conversationExpectsRoundTrip(text: string): boolean {
  return (
    /\b(up\s+(?:and|then|&)\s+down|down\s+(?:and|then|&)\s+up)\b/i.test(text) ||
    /\b(back\s+again|round[\s-]trip|there\s+and\s+back)\b/i.test(text) ||
    /\b(up|ascend|rise|going\s+up)\b.{1,60}\b(back\s+down|then\s+down|and\s+down|down\s+again|back\s+again)\b/i.test(
      text,
    )
  );
}

/** Reject collapsed single-hold answers when the user asked for a journey. */
function protocolViolatesUserIntent(protocol: SessionProtocol, conversationText: string): boolean {
  if (protocol.steps.length === 0) {
    return true;
  }
  if (conversationExpectsRoundTrip(conversationText) && protocol.steps.length < 2) {
    return true;
  }
  if (!conversationExpectsMultipleSteps(conversationText)) {
    return false;
  }
  if (protocol.steps.length >= 2) {
    return false;
  }
  const step = protocol.steps[0];
  const isHold = Math.abs(step.startBeatHz - step.endBeatHz) < 0.05;
  if (isHold) {
    return true;
  }
  const label = step.label.toLowerCase();
  return /\bkhz\b|\b10k\b/.test(label);
}

async function requestGeminiProtocol(
  history: ChatTurn[],
  trimmed: string,
  options: {
    beatHz?: number;
    gain?: number;
    engineType: EngineMode;
    premium: boolean;
    experimental: boolean;
  },
): Promise<{raw: unknown | null; parsed: SessionProtocol | null}> {
  const session = {
    beatHz: options.beatHz ?? 10,
    carrierHz: 220,
    gain: options.gain ?? 0.45,
    engineType: options.engineType,
    premium: options.premium,
    experimental: options.experimental,
  };
  const conversationText = buildUserConversationText(history, trimmed);
  const intentText = buildIntentParsingText(history, trimmed);

  const raw = await geminiProtocolSequence(history, trimmed, session, {repair: false, compact: true});
  if (raw == null) {
    return {raw: null, parsed: null};
  }
  const parsed = parseGeminiProtocol(raw, options.engineType, intentText);
  if (
    parsed != null &&
    !protocolLooksLikeKhzMisparse(parsed, intentText) &&
    !protocolViolatesUserIntent(parsed, intentText)
  ) {
    return {raw, parsed};
  }
  return {raw, parsed: null};
}

function maxMinutesMentioned(prompt: string): number {
  let max = 0;
  for (const m of prompt.matchAll(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min\b)/gi)) {
    max = Math.max(max, parseFloat(m[1]));
  }
  for (const m of prompt.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr\b)/gi)) {
    max = Math.max(max, parseFloat(m[1]) * 60);
  }
  for (const m of prompt.matchAll(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec\b)/gi)) {
    max = Math.max(max, parseFloat(m[1]) / 60);
  }
  return max;
}

function normalizeStepDurationSec(raw: unknown, prompt: string): number | null {
  const durationMin = Number(
    typeof raw === 'object' && raw != null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).durationMin ??
          (raw as Record<string, unknown>).durationMinutes ??
          (raw as Record<string, unknown>).minutes
      : NaN,
  );
  if (Number.isFinite(durationMin) && durationMin > 0) {
    return Math.max(1, Math.round(durationMin * 60));
  }

  const durationSec = Number(
    typeof raw === 'object' && raw != null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).durationSec ??
          (raw as Record<string, unknown>).durationSeconds
      : NaN,
  );
  if (Number.isFinite(durationSec) && durationSec > 0) {
    const maxMin = maxMinutesMentioned(prompt);
    if (maxMin > 0 && durationSec <= maxMin + 0.01 && durationSec < 300) {
      return Math.max(1, Math.round(durationSec * 60));
    }
    return Math.max(1, Math.round(durationSec));
  }

  const durationGeneric = Number(
    typeof raw === 'object' && raw != null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).duration
      : NaN,
  );
  if (!Number.isFinite(durationGeneric) || durationGeneric <= 0) {
    return null;
  }
  const maxMin = maxMinutesMentioned(prompt);
  if (maxMin > 0 && durationGeneric <= maxMin + 0.01 && durationGeneric < 300) {
    return Math.max(1, Math.round(durationGeneric * 60));
  }
  return Math.max(1, Math.round(durationGeneric));
}

function mergeProtocolSteps(
  primary: SessionProtocol,
  secondary: SessionProtocol | null,
): SessionProtocol {
  if (secondary == null) {
    return primary;
  }
  return normalizeProtocol({
    ...secondary,
    steps: primary.steps,
    title: secondary.title || primary.title,
    description: secondary.description || primary.description,
  });
}

function isLocalParseAuthoritative(protocol: SessionProtocol): boolean {
  if (protocol.steps.length >= 2) {
    return true;
  }
  if (protocol.steps.length === 0) {
    return false;
  }
  const step = protocol.steps[0];
  if (Math.abs(step.startBeatHz - step.endBeatHz) >= 0.05) {
    return true;
  }
  if (protocol.description.includes('timings and frequencies')) {
    return true;
  }
  if (protocol.description.includes('duration and frequency')) {
    return true;
  }
  if (step.label.includes('→')) {
    return true;
  }
  if (step.label !== 'Hold · 10 Hz' && !step.label.endsWith(' Hz hold')) {
    return true;
  }
  return false;
}

function hasExplicitPerStepDurations(history: ChatTurn[], latest: string): boolean {
  const text = normalizeConversationForParsing(buildUserConversationText(history, latest));
  const durations = collectDurationSecMentions(text);
  return /\b(then|→|->)\b/i.test(text) && durations.length >= 2;
}

function parseGeminiProtocol(
  raw: unknown,
  defaultEngine: EngineMode,
  prompt: string,
): SessionProtocol | null {
  const obj = unwrapGeminiProtocolPayload(raw);
  if (obj == null) {
    return null;
  }
  const stepsRaw = obj.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    return null;
  }

  const steps: ProtocolStep[] = stepsRaw
    .map((item, i) => {
      if (typeof item !== 'object' || item == null) {
        return null;
      }
      const s = item as Record<string, unknown>;
      const durationSec = normalizeStepDurationSec(s, prompt);
      const startBeatHz =
        parseBeatHzField(s.startBeatHz) ??
        parseBeatHzField(s.beatHz) ??
        parseBeatHzField(s.frequency) ??
        parseBeatHzField(s.frequencyHz) ??
        parseBeatHzField(s.targetFrequencyHz) ??
        parseBeatHzField(s.targetBeatHz);
      const endBeatHz =
        parseBeatHzField(s.endBeatHz) ??
        parseBeatHzField(s.targetBeatHz) ??
        parseBeatHzField(s.endFrequencyHz) ??
        startBeatHz;
      if (durationSec == null || startBeatHz == null || endBeatHz == null) {
        return null;
      }
      const curve: RampCurve = s.curve === 'linear' ? 'linear' : 'logarithmic';
      return makeStep(
        {
          id: typeof s.id === 'string' ? s.id : `step-${i}`,
          label: typeof s.label === 'string' ? s.label : `Step ${i + 1}`,
          durationSec,
          startBeatHz,
          endBeatHz,
          curve,
          engineMode: parseEngineMode(s.engineMode, defaultEngine),
          startGain: Number.isFinite(Number(s.startGain)) ? Number(s.startGain) : undefined,
          endGain: Number.isFinite(Number(s.endGain)) ? Number(s.endGain) : undefined,
        },
        defaultEngine,
      );
    })
    .filter((s): s is ProtocolStep => s != null);

  if (steps.length === 0) {
    return null;
  }

  const fadeFromText = parseFadeOutFromText(prompt);
  const promptIsExact = /\b(exact(ly)?|precise(ly)?)\b.*\b(min(utes?)?|sec(onds?)?|hour)/i.test(prompt);
  const fadeOutDurationSec = Number.isFinite(Number(obj.fadeOutDurationSec))
    ? Number(obj.fadeOutDurationSec)
    : (fadeFromText?.fadeOutDurationSec ?? (promptIsExact ? 0 : undefined));
  const fadeOutStartGain = Number.isFinite(Number(obj.fadeOutStartGain))
    ? Number(obj.fadeOutStartGain)
    : fadeFromText?.fadeOutStartGain;
  const fadeOutEndGain = Number.isFinite(Number(obj.fadeOutEndGain))
    ? Number(obj.fadeOutEndGain)
    : fadeFromText?.fadeOutEndGain;

  return normalizeProtocol({
    id: `ai-${Date.now()}`,
    title: typeof obj.title === 'string' ? obj.title : 'Custom Sequence',
    description: typeof obj.description === 'string' ? obj.description : 'AI-generated protocol',
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: obj.stopAfterPlayback !== false,
    fadeOutDurationSec: fadeOutDurationSec ?? 30,
    fadeOutStartGain: fadeOutStartGain ?? steps[steps.length - 1]?.endGain ?? 0.35,
    fadeOutEndGain: fadeOutEndGain ?? 0.04,
  });
}

export type ProtocolGenerationResult = {
  protocol: SessionProtocol;
  summary: string;
};

function formatStepDuration(sec: number): string {
  if (sec < 60) {
    return `${Math.round(sec)} sec`;
  }
  const min = sec / 60;
  if (min < 10 && !Number.isInteger(min)) {
    return `${min.toFixed(1)} min`;
  }
  return `${Math.round(min)} min`;
}

export function formatProtocolMessage(protocol: SessionProtocol): string {
  const lines = protocol.steps.map(
    (s, i) => `${i + 1}. ${s.label} — ${formatStepDuration(s.durationSec)}, ${s.startBeatHz}→${s.endBeatHz} Hz`,
  );
  const totalLabel = formatStepDuration(protocol.stopAfterSec);
  const fadeLine =
    protocol.fadeOutDurationSec > 0
      ? `Fade out: ${formatStepDuration(protocol.fadeOutDurationSec)} · ${Math.round(protocol.fadeOutStartGain * 100)}→${Math.round(protocol.fadeOutEndGain * 100)}% vol`
      : null;
  return [
    protocol.description,
    '',
    ...lines,
    '',
    ...(fadeLine != null ? [fadeLine, ''] : []),
    `Total ${totalLabel}${protocol.stopAfterPlayback ? ' · auto-stop' : ''}`,
    '',
    '→ Loaded in Protocol Sequences — started playback. Edit steps below or tap this message to re-apply.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Deterministic protocol generator — handles sweep patterns without Gemini
// ---------------------------------------------------------------------------

const DET_BANDS = [
  {label: 'HEALING',     scientific: 'Infra-slow',     minHz: 0,    maxHz: 0.5},
  {label: 'DREAM',       scientific: 'Delta',           minHz: 0.5,  maxHz: 4},
  {label: 'MEDITATE',    scientific: 'Theta',           minHz: 4,    maxHz: 8},
  {label: 'CALM',        scientific: 'Alpha',           minHz: 8,    maxHz: 12},
  {label: 'FOCUS',       scientific: 'Alpha-beta',      minHz: 12,   maxHz: 15},
  {label: 'ENGAGED',     scientific: 'Beta',            minHz: 15,   maxHz: 30},
  {label: 'COGNITION',   scientific: 'Gamma',           minHz: 30,   maxHz: 50},
  {label: 'INSIGHT',     scientific: 'High-gamma',      minHz: 50,   maxHz: 80},
  {label: 'SYNTHESIS',   scientific: 'Very-high-gamma', minHz: 80,   maxHz: 150},
  {label: 'INTEGRATION', scientific: 'Supra-gamma',     minHz: 150,  maxHz: 280},
  {label: 'INFINITE',    scientific: 'Omega',           minHz: 280,  maxHz: 500},
  {label: 'EXPERIMENT',  scientific: 'Experimental',    minHz: 500,  maxHz: 1000},
] as const;

function stateToHz(text: string, maxHz: number, minHz: number): number | null {
  const t = text.toLowerCase();
  // Explicit extremes first
  if (/\b(most[\s-]intense|highest[\s-]?(available|freq)?|maximum[\s-]?freq|top[\s-]?freq)\b/.test(t)) return maxHz;
  if (/\b(lowest[\s-]?(available|freq)?|minimum[\s-]?freq|bottom[\s-]?freq|lowest)\b/.test(t)) return minHz;
  if (/\bhighest\b/.test(t)) return maxHz;
  // Explicit Hz literal (e.g. "40hz", "10 hz")
  const litM = t.match(/\b(\d+(?:\.\d+)?)\s*hz\b/);
  if (litM) {
    const v = parseFloat(litM[1]);
    if (isFinite(v) && v > 0) return Math.min(Math.max(v, minHz), maxHz);
  }
  // Named bands (specific — checked before general high/low/middle)
  if (/\b(intense|high[\s-]energy|peak|cognition|gamma)\b/.test(t)) return Math.min(40, maxHz);
  if (/\b(focused|alert|work|beta|energetic|active|engaged)\b/.test(t)) return Math.min(22, maxHz);
  if (/\b(focus|smr|alpha[\s-]beta)\b/.test(t)) return Math.min(13, maxHz);
  if (/\b(calm|relax(?:ed)?|alpha|present)\b/.test(t)) return Math.min(10, maxHz);
  if (/\b(meditat\w*|drowsy|creative|theta|twilight)\b/.test(t)) return Math.min(6, maxHz);
  if (/\b(sleep|delta|dream|deep[\s-]sleep|rest)\b/.test(t)) return Math.max(2, minHz);
  if (/\b(heal\w*|infra|sub[\s-]delta|epsilon)\b/.test(t)) return Math.max(0.1, minHz);
  // General anchors (last resort — broad words that appear in many contexts)
  if (/\bhigh(est)?\b/.test(t)) return maxHz;
  if (/\b(low(est)?|bottom)\b/.test(t)) return minHz;
  if (/\b(middle|mid(?:point)?|center|central|moderate|medium)\b/.test(t)) return Math.min(Math.max((maxHz + minHz) / 2, 10), maxHz);
  return null;
}

/**
 * Build a protocol deterministically for clear-cut sweep requests.
 * Handles two patterns without relying on Gemini:
 *   1. All-bands sweep  — "through each/every/all band(s)"
 *   2. Directional sweep — "from [state] down/up to [state]"
 * Returns null if the prompt doesn't match either pattern.
 */
function buildDeterministicProtocol(
  intentText: string,
  contextText: string,
  history: ChatTurn[],
  latest: string,
  options: {premium: boolean; experimental: boolean; engineType: EngineMode},
): SessionProtocol | null {
  const maxHz = options.experimental ? 1000 : options.premium ? 500 : 40;
  const minHz = options.premium ? 0.05 : 0.5;
  const promptIsExact = /\b(exact(?:ly)?|precise(?:ly)?)\b/i.test(intentText);
  const totalSec = inferTargetTotalSecFromConversation(history, latest) ?? 5 * 60;
  const fadeSec = promptIsExact ? 0 : 30;

  // ---------------------------------------------------------------------------
  // Direction resolution — latest message takes priority over history.
  // "reverse / flip / invert / other way / opposite" flips whatever the
  // conversation established so far. This handles follow-up modifications
  // like "now reverse that", "flip it", "go the other way", etc.
  // ---------------------------------------------------------------------------
  const latestNorm = latest.toLowerCase();
  const latestReverse =
    /\b(reverse|flip|invert|opposite|other[\s-]way|backwards?)\b/.test(latestNorm);
  const latestDown =
    /\b(down|descend|drop|fall|scale[\s-]down|ramp[\s-]down|high[\s-]to[\s-]low|highest\s+to\s+lowest)\b/.test(
      latestNorm,
    );
  const latestUp =
    /\b(up|ascend|rise|ascending|scale[\s-]up|ramp[\s-]up|low[\s-]to[\s-]high|lowest\s+to\s+highest)\b/.test(
      latestNorm,
    );
  const historyDown =
    /\b(down|descend|drop|fall|lowest|scale[\s-]down|ramp[\s-]down|high[\s-]to[\s-]low)\b/i.test(
      contextText,
    );
  const historyUp =
    /\b(up|ascend|rise|ascending|scale[\s-]up|ramp[\s-]up|low[\s-]to[\s-]high)\b/i.test(
      contextText,
    );

  let goingDown: boolean;
  if (latestReverse) {
    // Flip whatever direction the conversation established; default to ascending if unknown
    goingDown = historyDown ? false : historyUp ? true : false;
  } else if (latestDown) {
    goingDown = true;
  } else if (latestUp) {
    goingDown = false;
  } else {
    goingDown = historyDown;
  }

  const hasDirectionSignal = latestReverse || latestDown || latestUp || historyDown || historyUp;

  // ---------------------------------------------------------------------------
  // Round-trip / arc detection  — "up then down", "back and forth", etc.
  // Detected BEFORE all-bands so we can combine them.
  // ---------------------------------------------------------------------------
  const isRoundTrip =
    /\b(up\s+(?:and|then|&)\s+down|down\s+(?:and|then|&)\s+up)\b/i.test(intentText) ||
    /\b(rise\s+(?:and|then)\s+fall|ascend\s+(?:and|then)\s+descend)\b/i.test(intentText) ||
    /\b(back\s+(?:and\s+forth|again)|round[\s-]trip|there\s+and\s+back)\b/i.test(intentText) ||
    /\b(up|ascend|rise)\b.{1,60}\b(back\s+down|then\s+down|and\s+down|back\s+again)\b/i.test(
      intentText,
    ) ||
    /\b(down|descend|fall)\b.{1,60}\b(back\s+up|then\s+up|and\s+up|back\s+again)\b/i.test(
      intentText,
    );

  // For a round-trip: does the ascending phase come first?
  const ascendFirst =
    !isRoundTrip ||
    /\b(up\s+(?:and|then)\s+down|rise\s+(?:and|then)\s+fall|ascend\s+(?:and|then)\s+descend)\b/i.test(
      intentText,
    ) ||
    (!historyDown && !latestDown);

  // ---- Pattern 1: all-bands sweep (or all-bands arc) ----
  const isAllBands =
    /\b(each|every|all)\s+(?:(?:freq(?:uency)?|beat)\s+)?band/i.test(intentText) ||
    /\bthrough\s+(?:each\s+|every\s+|all\s+)?(?:(?:freq(?:uency)?|beat)\s+)?band/i.test(
      intentText,
    ) ||
    /\ball\s+(?:(?:freq(?:uency)?|beat)\s+)?(?:range|zone|level)s?/i.test(intentText) ||
    /\bfull\s+(?:sweep|scan|range|spectrum)\b/i.test(intentText) ||
    /\b(?:entire|complete|whole)\s+(?:range|spectrum|freq(?:uency)?\s+range)\b/i.test(
      intentText,
    );

  if (isAllBands) {
    const applicable = (DET_BANDS as readonly (typeof DET_BANDS)[number][]).filter(b => {
      const capMax = Math.min(b.maxHz, maxHz);
      const capMin = Math.max(b.minHz, minHz);
      return capMax > capMin && (options.experimental || b.label !== 'EXPERIMENT');
    });

    if (isRoundTrip) {
      // All-bands arc: ascending through all bands, then descending through all bands
      const ascending = applicable;
      const descending = [...applicable].reverse();
      const phases = ascendFirst ? [ascending, descending] : [descending, ascending];
      const allSteps = phases.flatMap((phase, phaseIdx) =>
        phase.map((b, i) => {
          const capMax = Math.min(b.maxHz, maxHz);
          const capMin = Math.max(b.minHz, minHz);
          const isAscPhase = phaseIdx === (ascendFirst ? 0 : 1);
          const [startBeatHz, endBeatHz] = isAscPhase ? [capMin, capMax] : [capMax, capMin];
          return makeStep(
            {
              id: `arc-${phaseIdx}-${i}`,
              label: `${b.label} · ${b.scientific}`,
              durationSec: Math.max((totalSec - fadeSec) / (applicable.length * 2), 1),
              startBeatHz,
              endBeatHz,
              curve: 'logarithmic' as RampCurve,
            },
            options.engineType,
          );
        }),
      );
      return normalizeProtocol({
        id: `ai-arc-${Date.now()}`,
        title: `Band Arc (${ascendFirst ? '↑↓' : '↓↑'})`,
        description: `${allSteps.length}-step arc through every accessible band, ${ascendFirst ? 'low→high→low' : 'high→low→high'}, ${formatStepDuration(totalSec)} total.`,
        steps: allSteps,
        stopAfterSec: 0,
        stopAfterPlayback: true,
        fadeOutDurationSec: fadeSec,
        fadeOutStartGain: 0.35,
        fadeOutEndGain: 0.04,
      });
    }

    const ordered = goingDown ? [...applicable].reverse() : applicable;
    const stepSec = Math.max((totalSec - fadeSec) / ordered.length, 1);

    const steps = ordered.map((b, i) => {
      const capMax = Math.min(b.maxHz, maxHz);
      const capMin = Math.max(b.minHz, minHz);
      const [startBeatHz, endBeatHz] = goingDown ? [capMax, capMin] : [capMin, capMax];
      return makeStep(
        {
          id: `band-${i}`,
          label: `${b.label} · ${b.scientific}`,
          durationSec: stepSec,
          startBeatHz,
          endBeatHz,
          curve: 'logarithmic' as RampCurve,
        },
        options.engineType,
      );
    });

    return normalizeProtocol({
      id: `ai-sweep-${Date.now()}`,
      title: `${goingDown ? 'Descending' : 'Ascending'} Band Sweep`,
      description: `${ordered.length}-step sweep through every accessible band${goingDown ? ', high→low' : ', low→high'}, ${formatStepDuration(totalSec)} total.`,
      steps,
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: fadeSec,
      fadeOutStartGain: 0.35,
      fadeOutEndGain: 0.04,
    });
  }

  // ---- Pattern 2: standalone round-trip arc (no all-bands, no specific intermediate target) ----
  // Only fire if we can't extract a richer multi-waypoint chain below.
  // Defer isRoundTrip to after waypoint extraction so "go up then back to focus"
  // (3 waypoints) isn't collapsed into the minHz→maxHz→minHz arc.
  // Handled after Pattern 3 below.

  // ---- Pattern 3: multi-waypoint journey (e.g. "low → high → focus") ----
  // Splits the conversation at "then [back] [to]", "and then", "→", "followed by"
  // and resolves each waypoint to an exact Hz. If >= 2 distinct Hz values are
  // found the protocol is generated deterministically without Gemini.
  {
    // Helper: extract explicit Hz literal from a short text ("30hz", "10 hz", etc.)
    const parseHzLiteral = (t: string): number | null => {
      const m = t.match(/\b(\d+(?:\.\d+)?)\s*hz\b/i);
      if (!m) return null;
      const v = parseFloat(m[1]);
      return isFinite(v) && v > 0 ? v : null;
    };

    // Helper: resolve a segment to an Hz value (literal first, then named state)
    const resolveSegHz = (seg: string): number | null => {
      const lit = parseHzLiteral(seg);
      if (lit !== null) return Math.min(Math.max(lit, minHz), maxHz);
      return stateToHz(seg, maxHz, minHz);
    };

    // Split at phrase boundaries that separate phases of a journey.
    // Captures: "then back to", "then", "and then", "→", "followed by", "after that"
    const BOUNDARY =
      /\s+(?:then\s+back\s+to|then\s+back|then\s+(?:go\s+)?(?:to|down\s+to|up\s+to)?|and\s+then|→|followed\s+by|after\s+that|,\s*then)\s*/i;
    const segments = intentText.split(BOUNDARY).filter(s => s.trim().length > 0);

    if (segments.length >= 2) {
      const waypoints: number[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i].trim();
        if (i === 0) {
          // First segment: try "from X to Y" → extract both start and end
          const fromTo = seg.match(/(?:\bfrom\s+)?(?:the\s+)?(.{2,30}?)\s+to\s+(?:the\s+)?(.{2,30})$/i);
          if (fromTo) {
            const startHz = resolveSegHz(fromTo[1]);
            const endHz = resolveSegHz(fromTo[2]);
            if (startHz !== null) waypoints.push(startHz);
            if (endHz !== null && (waypoints.length === 0 || Math.abs(endHz - waypoints[waypoints.length - 1]) > 0.1)) {
              waypoints.push(endHz);
            }
          } else {
            const hz = resolveSegHz(seg);
            if (hz !== null) waypoints.push(hz);
          }
        } else {
          // Subsequent segments: find the target Hz anywhere in the segment
          const hz = resolveSegHz(seg);
          if (hz !== null) {
            const last = waypoints[waypoints.length - 1];
            if (last === undefined || Math.abs(hz - last) > 0.1) {
              waypoints.push(hz);
            }
          }
        }
      }

      if (waypoints.length >= 2) {
        // 2+ waypoints: multi-segment journey → build N-1 steps
        const stepSec = Math.max((totalSec - fadeSec) / (waypoints.length - 1), 1);
        const steps = waypoints.slice(0, -1).map((startBeatHz, i) => {
          const endBeatHz = waypoints[i + 1];
          return makeStep(
            {
              id: `wp-${i}`,
              label: `${startBeatHz.toFixed(1)}→${endBeatHz.toFixed(1)} Hz`,
              durationSec: stepSec,
              startBeatHz,
              endBeatHz,
              curve: (endBeatHz < startBeatHz ? 'logarithmic' : 'linear') as RampCurve,
            },
            options.engineType,
          );
        });
        return normalizeProtocol({
          id: `ai-wp-${Date.now()}`,
          title: 'Custom Journey',
          description:
            waypoints.map(hz => `${hz.toFixed(1)} Hz`).join(' → ') +
            `, ${formatStepDuration(totalSec)} total.`,
          steps,
          stopAfterSec: 0,
          stopAfterPlayback: true,
          fadeOutDurationSec: fadeSec,
          fadeOutStartGain: 0.35,
          fadeOutEndGain: 0.04,
        });
      }
    }
  }

  // ---- Pattern 2 (deferred): standalone round-trip arc ----
  if (isRoundTrip) {
    const startHz = ascendFirst ? minHz : maxHz;
    const midHz = ascendFirst ? maxHz : minHz;
    const halfSec = Math.max((totalSec - fadeSec) / 2, 1);
    const step1 = makeStep(
      {
        id: 'arc-1',
        label: `${startHz.toFixed(1)}→${midHz.toFixed(1)} Hz`,
        durationSec: halfSec,
        startBeatHz: startHz,
        endBeatHz: midHz,
        curve: (ascendFirst ? 'linear' : 'logarithmic') as RampCurve,
      },
      options.engineType,
    );
    const step2 = makeStep(
      {
        id: 'arc-2',
        label: `${midHz.toFixed(1)}→${startHz.toFixed(1)} Hz`,
        durationSec: halfSec,
        startBeatHz: midHz,
        endBeatHz: startHz,
        curve: (ascendFirst ? 'logarithmic' : 'linear') as RampCurve,
      },
      options.engineType,
    );
    return normalizeProtocol({
      id: `ai-arc-${Date.now()}`,
      title: ascendFirst ? 'Rising Arc' : 'Falling Arc',
      description: `${formatStepDuration(totalSec)} round-trip sweep, ${ascendFirst ? `${startHz}→${midHz}→${startHz} Hz` : `${startHz}→${midHz}→${startHz} Hz`}.`,
      steps: [step1, step2],
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: fadeSec,
      fadeOutStartGain: 0.35,
      fadeOutEndGain: 0.04,
    });
  }

  // ---- Pattern 2: directional two-state sweep ----
  if (!hasDirectionSignal) {
    return null;
  }

  const startMatch = intentText.match(
    /(?:start(?:ing)?\s+(?:at\s+)?|begin(?:ning)?\s+(?:at\s+)?|from\s+(?:the\s+)?)(.{3,50}?)(?:\s+and\b|\s+(?:drop|ramp|go|scale|descend|fall|end|then)\b|,|$)/i,
  );
  const endMatch = intentText.match(
    /(?:(?:drop|go|scale|ramp|fade|descend|fall|transition)\w*\s+(?:down\s+)?to|down\s+to|to\s+(?:a\s+|the\s+)?)(.{3,50}?)(?:\s+over\b|\s+in\b|\s+for\b|\s+going\b|$)/i,
  );

  let startHz = stateToHz(startMatch?.[1] ?? '', maxHz, minHz);
  let endHz = stateToHz(endMatch?.[1] ?? '', maxHz, minHz);

  // Anchor fallbacks — directional words anywhere in text
  if (startHz === null && /\b(highest|most[\s-]intense|maximum)\b/i.test(intentText)) {
    startHz = maxHz;
  }
  if (endHz === null && /\b(lowest|minimum)\b/i.test(intentText)) endHz = minHz;
  if (endHz === null && /\b(sleep|delta|dream)\b/i.test(intentText)) endHz = Math.max(2, minHz);
  if (startHz === null && /\b(intense|gamma|cognition)\b/i.test(intentText)) {
    startHz = Math.min(40, maxHz);
  }

  // If "reverse" with no state words: swap inferred endpoints based on direction
  if (latestReverse && startHz !== null && endHz !== null) {
    [startHz, endHz] = [endHz, startHz];
  }

  // Directional defaults: if only one resolved, infer the other from current direction
  if (startHz !== null && endHz === null) endHz = goingDown ? minHz : maxHz;
  if (startHz === null && endHz !== null) startHz = goingDown ? maxHz : minHz;

  if (startHz === null || endHz === null || Math.abs(startHz - endHz) < 0.1) {
    return null;
  }

  const curve: RampCurve = endHz < startHz ? 'logarithmic' : 'linear';
  const step = makeStep(
    {
      id: 'sweep-1',
      label: `${startHz.toFixed(1)}→${endHz.toFixed(1)} Hz`,
      durationSec: Math.max(totalSec - fadeSec, 10),
      startBeatHz: startHz,
      endBeatHz: endHz,
      curve,
    },
    options.engineType,
  );

  return normalizeProtocol({
    id: `ai-sweep-${Date.now()}`,
    title: 'Custom Frequency Sweep',
    description: `Continuous sweep from ${startHz.toFixed(1)} Hz to ${endHz.toFixed(1)} Hz.`,
    steps: [step],
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: step.endGain ?? 0.35,
    fadeOutEndGain: 0.04,
  });
}

function applyDurationIntent(
  protocol: SessionProtocol,
  history: ChatTurn[],
  latest: string,
): SessionProtocol {
  if (hasExplicitPerStepDurations(history, latest)) {
    return protocol;
  }
  const targetSec = inferTargetTotalSecFromConversation(history, latest);
  if (targetSec == null || protocol.steps.length === 0) {
    return protocol;
  }
  const currentSec = computeStepsTotalSec(protocol.steps);
  const tolerance = Math.max(5, targetSec * 0.02);
  if (Math.abs(currentSec - targetSec) <= tolerance) {
    return protocol;
  }
  return normalizeProtocol({
    ...protocol,
    steps: scaleProtocolStepsToTotalSec(protocol.steps, targetSec),
  });
}

function applyFadeOutIntent(
  protocol: SessionProtocol,
  history: ChatTurn[],
  latest: string,
  conversationText: string,
): SessionProtocol {
  const patch =
    parseFadeOutFromConversation(history, latest) ?? parseFadeOutFromText(conversationText);
  if (patch == null) {
    return protocol;
  }
  return normalizeProtocol({...protocol, ...patch});
}

function buildProtocolFromSources(
  localExplicit: SessionProtocol | null,
  parsed: SessionProtocol | null,
  conversationText: string,
  engineType: EngineMode,
): SessionProtocol | null {
  const localAuthoritative =
    localExplicit != null && isLocalParseAuthoritative(localExplicit);

  if (localAuthoritative && parsed != null) {
    return mergeProtocolSteps(localExplicit, parsed);
  }
  if (parsed != null) {
    return parsed;
  }
  if (localAuthoritative && localExplicit != null) {
    return localExplicit;
  }
  if (localExplicit != null && localExplicit.steps.length > 0) {
    return localExplicit;
  }
  if (conversationHasExplicitSequenceNumbers([], conversationText)) {
    const retry = parseExplicitProtocolFromPrompt(conversationText, engineType);
    if (retry != null && isLocalParseAuthoritative(retry)) {
      return retry;
    }
  }
  return null;
}

export async function generateProtocolFromPrompt(
  prompt: string,
  options: {
    history?: ChatTurn[];
    beatHz?: number;
    gain?: number;
    engineType?: EngineMode;
    premium?: boolean;
    experimental?: boolean;
  } = {},
): Promise<ProtocolGenerationResult | null> {
  const trimmed = prompt.trim();
  const history = options.history ?? [];
  if (!trimmed) {
    return null;
  }

  const engineType = options.engineType ?? 'binaural';
  const conversationText = buildUserConversationText(history, trimmed);
  const intentText = buildIntentParsingText(history, trimmed);
  const continuation = isConversationContinuation(history, trimmed);
  const premium = options.premium ?? false;
  const experimental = options.experimental ?? false;

  const wantsSequence =
    wantsProtocolSequence([], trimmed) ||
    (continuation && wantsProtocolSequence(history, trimmed));

  const experiential = classifyExperientialIntent(intentText);
  const wantsExperientialProtocol = experiential != null && experiential.prefersProtocol;

  // Pure carrier/pitch asks (e.g. "10 kHz for 2 minutes") belong on the guide path.
  if (
    parseCarrierHzFromPrompt(trimmed) != null &&
    !conversationExpectsMultipleSteps(intentText)
  ) {
    return null;
  }

  const parseHistory = continuation ? history : [];
  const localExplicit = conversationHasExplicitSequenceNumbers(parseHistory, trimmed)
    ? parseExplicitProtocolFromConversation(parseHistory, trimmed, engineType) ??
      parseExplicitProtocolFromPrompt(trimmed, engineType)
    : null;

  if (!wantsSequence && !wantsExperientialProtocol && localExplicit == null) {
    return null;
  }

  // -------------------------------------------------------------------------
  // 1) Gemini first — cloud NLU for any sequence / journey request.
  // -------------------------------------------------------------------------
  const {raw: geminiRaw, parsed: parsedFromGemini} = await requestGeminiProtocol(
    history,
    trimmed,
    {
      beatHz: options.beatHz,
      gain: options.gain,
      engineType,
      premium,
      experimental,
    },
  );

  if (parsedFromGemini != null) {
    let protocol = applyDurationIntent(parsedFromGemini, history, trimmed);
    protocol = applyFadeOutIntent(protocol, history, trimmed, conversationText);
    return {protocol, summary: formatProtocolMessage(protocol)};
  }

  if (geminiRaw != null) {
    return null;
  }

  if (getGeminiOutageReason() != null) {
    return null;
  }

  // -------------------------------------------------------------------------
  // 2) Local fallbacks — only when Gemini had no service outage this turn.
  // -------------------------------------------------------------------------
  if (localExplicit != null) {
    let normalized = applyDurationIntent(localExplicit, history, trimmed);
    normalized = applyFadeOutIntent(normalized, history, trimmed, conversationText);
    return {protocol: normalized, summary: formatProtocolMessage(normalized)};
  }

  if (experiential != null && experiential.prefersProtocol) {
    const expProtocol = buildExperientialProtocol(experiential, trimmed, engineType, {
      history,
      premium,
      experimental,
    });
    if (expProtocol != null) {
      let protocol = applyDurationIntent(expProtocol, history, trimmed);
      protocol = applyFadeOutIntent(protocol, history, trimmed, conversationText);
      return {protocol, summary: formatProtocolMessage(protocol)};
    }
  }

  const narrative = parseNarrativeJourneyFromText(intentText, engineType);
  if (narrative != null) {
    let protocol = applyDurationIntent(narrative, history, trimmed);
    protocol = applyFadeOutIntent(protocol, history, trimmed, conversationText);
    return {protocol, summary: formatProtocolMessage(protocol)};
  }

  // -------------------------------------------------------------------------
  // 3) Deterministic sweeps / arcs — clear geometric patterns.
  // -------------------------------------------------------------------------
  const deterministic = buildDeterministicProtocol(
    intentText,
    conversationText,
    history,
    trimmed,
    {
      premium,
      experimental,
      engineType,
    },
  );
  if (deterministic != null) {
    return {protocol: deterministic, summary: formatProtocolMessage(deterministic)};
  }

  const protocol = buildProtocolFromSources(localExplicit, null, conversationText, engineType);
  if (protocol != null) {
    let normalized = applyDurationIntent(protocol, history, trimmed);
    normalized = applyFadeOutIntent(normalized, history, trimmed, conversationText);
    return {protocol: normalized, summary: formatProtocolMessage(normalized)};
  }

  if (getGeminiOutageReason() != null) {
    return null;
  }

  return null;
}
