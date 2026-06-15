import type {EngineMode} from '../state/types';
import {getProtocolsForEngine} from '../protocol/builtinProtocols';
import {
  computeProtocolTotalSec,
  computeStepsTotalSec,
  normalizeProtocol,
  scaleProtocolStepsToTotalSec,
} from '../protocol/interpolateProtocol';
import type {ProtocolStep, RampCurve, SessionProtocol} from '../protocol/types';
import {geminiProtocolSequence} from './geminiChatClient';
import type {ChatTurn} from './aiPromptParsing';
import {isSequenceRequestInConversation} from './aiIntent';
import {bandNameToHz} from './parseProtocolFromPrompt';
import {
  buildUserConversationText,
  collectDurationSecMentions,
  conversationHasExplicitSequenceNumbers,
  inferTargetTotalSecFromConversation,
  normalizeConversationForParsing,
  parseExplicitProtocolFromConversation,
  parseExplicitProtocolFromPrompt,
  parseFadeOutFromConversation,
  parseFadeOutFromText,
} from './parseProtocolFromPrompt';

export {isSequenceRequest, isSequenceRequestInConversation} from './aiIntent';

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
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0.5, Math.min(500, raw));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const asNum = parseFloat(trimmed);
    if (Number.isFinite(asNum)) {
      return Math.max(0.5, Math.min(500, asNum));
    }
    const bandHz = bandNameToHz(trimmed);
    if (bandHz != null) {
      return bandHz;
    }
  }
  return fallback ?? null;
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
      ? (raw as Record<string, unknown>).durationSec
      : NaN,
  );
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return null;
  }

  const maxMin = maxMinutesMentioned(prompt);
  if (maxMin > 0 && durationSec <= maxMin + 0.01 && durationSec < 300) {
    return Math.max(1, Math.round(durationSec * 60));
  }
  return Math.max(1, Math.round(durationSec));
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
  if (step.label !== 'Hold · 10 Hz') {
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
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
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
        parseBeatHzField(s.frequency);
      const endBeatHz =
        parseBeatHzField(s.endBeatHz) ??
        parseBeatHzField(s.targetBeatHz) ??
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
  const fadeOutDurationSec = Number.isFinite(Number(obj.fadeOutDurationSec))
    ? Number(obj.fadeOutDurationSec)
    : fadeFromText?.fadeOutDurationSec;
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
): SessionProtocol {
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
  return localGenericSequence(conversationText, engineType);
}

export async function generateProtocolFromPrompt(
  prompt: string,
  options: {
    history?: ChatTurn[];
    beatHz?: number;
    gain?: number;
    engineType?: EngineMode;
  } = {},
): Promise<ProtocolGenerationResult | null> {
  const trimmed = prompt.trim();
  const history = options.history ?? [];
  if (!trimmed || !isSequenceRequestInConversation(history, trimmed)) {
    return null;
  }

  const engineType = options.engineType ?? 'binaural';
  const conversationText = buildUserConversationText(history, trimmed);

  const localExplicit = conversationHasExplicitSequenceNumbers(history, trimmed)
    ? parseExplicitProtocolFromConversation(history, trimmed, engineType) ??
      parseExplicitProtocolFromPrompt(trimmed, engineType)
    : null;

  const geminiRaw = await geminiProtocolSequence(history, trimmed, {
    beatHz: options.beatHz ?? 10,
    carrierHz: 220,
    gain: options.gain ?? 0.45,
    engineType,
    experimental: false,
  });

  const parsed =
    geminiRaw != null ? parseGeminiProtocol(geminiRaw, engineType, conversationText) : null;

  let protocol = buildProtocolFromSources(localExplicit, parsed, conversationText, engineType);

  protocol = applyDurationIntent(protocol, history, trimmed);
  protocol = applyFadeOutIntent(protocol, history, trimmed, conversationText);

  return {protocol, summary: formatProtocolMessage(protocol)};
}
