import type {ChatTurn} from './aiPromptParsing';
import type {EngineMode} from '../state/types';
import {normalizeProtocol} from '../protocol/interpolateProtocol';
import type {ProtocolStep, RampCurve, SessionProtocol} from '../protocol/types';

const HZ = /(\d+(?:\.\d+)?)\s*(?:hz|hertz)\b/gi;

const BAND_HZ: Record<string, number> = {
  epsilon: 0.5,
  delta: 2.5,
  theta: 6,
  alpha: 10,
  smr: 14,
  beta: 18,
  gamma: 40,
  lambda: 100,
};

const BAND_NAMES = Object.keys(BAND_HZ).join('|');

export function bandNameToHz(name: string): number | null {
  const key = name.toLowerCase().trim();
  return BAND_HZ[key] ?? null;
}

const STEP_SPLIT =
  /\s+(?:then|→|->|,\s*(?:then\s+)?|;\s*|\bstep\s+\d+\s*:?\s*|\bphase\s+\d+\s*:?\s*|\bstage\s+\d+\s*:?\s*|\bafter\s+that\s*|\bfollowed\s+by\s*|\bnext\s*,?\s*|\bfinally\s*,?\s*|\bbefore\s+(?:winding|wind(?:ing)?\s+down|the\s+final|the\s+last)\s*)/i;

/** Comma boundaries between phase clauses ("alpha for 10 min, glide to theta, hold delta 30 min"). */
const PHASE_COMMA_SPLIT =
  /,\s*(?=(?:\d+\s*(?:min|sec|hour)|hold|stay|maintain|start|begin|glide|ramp|transition|wind|sustain|alpha|beta|theta|delta|gamma|smr|epsilon|lambda)\b)/i;

const MOOD_BAND_PHRASES: {re: RegExp; hz: number; label: string}[] = [
  {re: /\bdeep(?:ly)?[\s-]?(?:restorative[\s-])?(?:sleep|delta)\b/i, hz: 2.5, label: 'Delta'},
  {re: /\brelaxed[\s-]?alpha\b/i, hz: 10, label: 'Alpha'},
  {re: /\bhyper[\s-]?focus(?:ed)?\b/i, hz: 22, label: 'Beta'},
  {re: /\bopen[\s-]?awareness\b/i, hz: 10, label: 'Alpha'},
  {re: /\bwind(?:ing)?[\s-]?down\b/i, hz: 8, label: 'Alpha'},
];

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

/**
 * True when the latest message refines or modifies the prior turn — not a fresh topic.
 * New topics in the same chat must be parsed from the latest message only.
 */
export function isConversationContinuation(history: ChatTurn[], latest: string): boolean {
  if (history.filter(t => t.role === 'user').length === 0) {
    return false;
  }
  const lower = latest.toLowerCase().trim();
  if (!lower) {
    return false;
  }
  if (
    /\b(reverse|flip|invert|opposite|other[\s-]way|backwards|longer|shorter|extend|continue)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\b(that|this|it|those|the sequence|the journey|the protocol|previous|last one)\b/i.test(lower)) {
    return true;
  }
  if (/\b(instead|rather|swap|change it|adjust|tweak|refine|more|less|gentler|stronger)\b/i.test(lower)) {
    return true;
  }
  if (/\b(\+|\-|by)\s*\d+(?:\.\d+)?\s*(?:hz|hertz|min|minutes?|mins?)\b/i.test(lower)) {
    return true;
  }
  if (lower.length <= 48 && /\b(now|same|again|keep)\b/i.test(lower)) {
    return true;
  }
  return false;
}

/** Text used for intent/sequencer parsing — latest-only unless continuing prior output. */
export function buildIntentParsingText(history: ChatTurn[], latest: string): string {
  const tail = latest.trim();
  if (!tail) {
    return '';
  }
  if (isConversationContinuation(history, latest)) {
    return buildUserConversationText(history, latest);
  }
  return tail;
}

/** Broad state/band inference when the user did not give an exact Hz. Returns null if nothing matched. */
export function inferBeatHzFromPrompt(text: string): number | null {
  const normalized = normalizeConversationForParsing(text);
  if (!normalized) {
    return null;
  }

  const explicit = extractTargetHzFromConversationText(normalized);
  if (explicit != null) {
    return explicit;
  }

  const bands = extractOrderedBandTargets(normalized);
  if (bands.length > 0) {
    const towardEnd = /\b(to|into|toward|towards|ending|end(?:\s+at)?|finish(?:\s+at)?|settle(?:\s+in)?)\b/i.test(
      normalized,
    );
    return (towardEnd && bands.length > 1 ? bands[bands.length - 1] : bands[0]).hz;
  }

  const stateRules: {re: RegExp; hz: number}[] = [
    {re: /\b(epsilon|infra[\s-]?slow|autonomic reset|nervous system reset)\b/i, hz: 0.5},
    {re: /\b(deep sleep|restorative sleep|insomnia|bedtime|asleep|slumber|pass out)\b/i, hz: 2.5},
    {re: /\b(sleep|delta|dream(?:ing)?|drowsy|night(?:time)?)\b/i, hz: 2.5},
    {re: /\b(power nap|quick nap|short rest)\b/i, hz: 4.5},
    {re: /\b(nap|doze)\b/i, hz: 4.5},
    {re: /\b(lucid|hypnagog|twilight state)\b/i, hz: 5},
    {re: /\b(meditat\w*|mindful|inner peace|spiritual|grounding)\b/i, hz: 6},
    {re: /\b(anxiety|anxious|panic|racing thoughts|overwhelm|worried|stressful)\b/i, hz: 8},
    {re: /\b(relax|unwind|calm(?: down)?|soothe|peaceful|de[\s-]?stress|wind down)\b/i, hz: 9.5},
    {re: /\b(creativ\w*|brainstorm|imagination|artistic flow)\b/i, hz: 10},
    {re: /\b(flow state|in the zone|open awareness)\b/i, hz: 12},
    {re: /\b(adhd|hyper[\s-]?focus|concentrat\w*|study(?:ing)?|deep work|productiv\w*|deadline|exam)\b/i, hz: 14},
    {re: /\b(focus(?:ed)?|work(?:ing)?|task|attention|alert(?:ness)?)\b/i, hz: 18},
    {re: /\b(energy|energiz\w*|workout|exercise|motivat\w*|wake(?: up)?)\b/i, hz: 20},
    {re: /\b(memory|learn(?:ing)?|cognition|cognitive|mental clarity)\b/i, hz: 40},
    {re: /\b(gamma|peak performance|intense focus)\b/i, hz: 40},
    {re: /\b(lambda|hyper[\s-]?gamma|supra[\s-]?gamma)\b/i, hz: 100},
  ];

  for (const {re, hz} of stateRules) {
    if (re.test(normalized)) {
      return hz;
    }
  }

  return null;
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
  if (lastHz == null) {
    const bandMatches = [...normalized.matchAll(new RegExp(`\\b(${BAND_NAMES})\\b`, 'gi'))];
    if (bandMatches.length > 0) {
      lastHz = bandNameToHz(bandMatches[bandMatches.length - 1][1]);
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
  if (values.length === 0) {
    const bandMatch = chunk.match(new RegExp(`\\b(${BAND_NAMES})\\b`, 'i'));
    if (bandMatch != null) {
      const hz = bandNameToHz(bandMatch[1]);
      if (hz != null) {
        values.push(hz);
      }
    }
  }
  return values;
}

function parseBandGlide(chunk: string): {start: number; end: number; curve: RampCurve} | null {
  const bandRe = new RegExp(
    `(?:from|start(?:ing)?\\s+(?:at|in)?\\s*|ramp(?:s|ing)?\\s+(?:from\\s+)?|glide(?:\\s+(?:down|up|through))?\\s+(?:from\\s+)?|transition(?:ing)?\\s+(?:from\\s+)?)(${BAND_NAMES}).{0,60}(?:to|→|->|down\\s+to|up\\s+to|into|through)\\s+(${BAND_NAMES})`,
    'i',
  );
  const m = chunk.match(bandRe);
  if (m == null) {
    return null;
  }
  const start = bandNameToHz(m[1]);
  const end = bandNameToHz(m[2]);
  if (start == null || end == null) {
    return null;
  }
  const curve: RampCurve = /log|smooth|gradual|sleep|wind/i.test(chunk) ? 'logarithmic' : 'linear';
  return {start, end, curve};
}

/** Ordered band / mood targets as they appear in the prompt (deduped when adjacent). */
export function extractOrderedBandTargets(text: string): {hz: number; label: string}[] {
  const normalized = normalizeConversationForParsing(text);
  const hits: {index: number; hz: number; label: string}[] = [];

  for (const {re, hz, label} of MOOD_BAND_PHRASES) {
    const m = normalized.match(re);
    if (m?.index != null) {
      hits.push({index: m.index, hz, label});
    }
  }

  const bandRe = new RegExp(`\\b(${BAND_NAMES})\\b`, 'gi');
  for (const m of normalized.matchAll(bandRe)) {
    if (m.index == null) {
      continue;
    }
    const hz = bandNameToHz(m[1]);
    if (hz == null) {
      continue;
    }
    hits.push({index: m.index, hz, label: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()});
  }

  hits.sort((a, b) => a.index - b.index);
  const out: {hz: number; label: string}[] = [];
  for (const hit of hits) {
    const last = out[out.length - 1];
    if (last == null || Math.abs(last.hz - hit.hz) > 0.05) {
      out.push({hz: hit.hz, label: hit.label});
    }
  }
  return out;
}

function splitIntoPhases(normalized: string): string[] {
  const byThen = normalized
    .split(STEP_SPLIT)
    .map(c => c.trim())
    .filter(Boolean);
  if (byThen.length >= 2) {
    return byThen;
  }
  const byComma = normalized
    .split(PHASE_COMMA_SPLIT)
    .map(c => c.trim())
    .filter(Boolean);
  if (byComma.length >= 2) {
    return byComma;
  }
  return byThen.length > 0 ? byThen : [normalized];
}

function parseStepChunkWithDuration(
  chunk: string,
  durationSec: number,
  carryHz: number,
  engine: EngineMode,
  index: number,
): ProtocolStep | null {
  const glide = parseGlide(chunk);
  const hzValues = parseHzValues(chunk);

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
    const isHold = /\b(hold|stay|maintain|keep|sustain)\b/i.test(chunk);
    if (isHold || Math.abs(hz - carryHz) < 0.05 || carryHz <= 0) {
      return buildStep(
        {durationSec, startBeatHz: hz, endBeatHz: hz, curve: 'linear', label: `${hz} Hz hold`},
        engine,
        index,
      );
    }
    return buildStep(
      {
        durationSec,
        startBeatHz: carryHz > 0 ? carryHz : hz,
        endBeatHz: hz,
        curve: 'logarithmic',
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

/**
 * Multi-phase natural language ("alpha for 10 min, glide to theta, hold delta 30 min").
 * Uses duration mentions in order when a phase clause omits its own timing.
 */
export function parseNarrativeJourneyFromText(
  prompt: string,
  engine: EngineMode,
): SessionProtocol | null {
  const normalized = normalizeConversationForParsing(prompt);
  const durationQueue = collectDurationSecMentions(normalized);
  const phases = splitIntoPhases(normalized);

  if (phases.length < 2 && durationQueue.length < 2) {
    return buildBandChainProtocol(normalized, engine);
  }

  const steps: ProtocolStep[] = [];
  let carryHz = 0;

  const phaseDurations: (number | null)[] = phases.map(p => parseDurationSec(p));
  const explicitTotal = inferTargetTotalSecFromPrompt(normalized);
  let assigned = phaseDurations.reduce((sum, d) => sum + (d ?? 0), 0);
  const unassignedIdx = phaseDurations
    .map((d, i) => (d == null ? i : -1))
    .filter(i => i >= 0);

  if (unassignedIdx.length > 0) {
    let pool =
      explicitTotal != null && explicitTotal > assigned
        ? explicitTotal - assigned
        : durationQueue.filter((_, i) => i >= phaseDurations.filter(d => d != null).length).reduce((a, b) => a + b, 0);

    if (pool <= 0 && durationQueue.length === 1 && phases.length === 2) {
      pool = durationQueue[0];
    }

    if (pool > 0) {
      const each = Math.max(pool / unassignedIdx.length, 1);
      for (const idx of unassignedIdx) {
        phaseDurations[idx] = each;
      }
      assigned += each * unassignedIdx.length;
    }
  }

  for (let i = 0; i < phases.length; i++) {
    const durationSec = phaseDurations[i];
    if (durationSec == null) {
      continue;
    }
    const step = parseStepChunkWithDuration(phases[i], durationSec, carryHz, engine, steps.length);
    if (step != null) {
      steps.push(step);
      carryHz = step.endBeatHz;
    }
  }

  if (steps.length >= 2) {
    return mergeFadeOut(normalized, {
      id: `ai-narrative-${Date.now()}`,
      title: inferProtocolTitle(normalized),
      description: 'Built from your multi-phase journey description.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: steps[steps.length - 1]?.endGain ?? 0.35,
      fadeOutEndGain: 0.04,
      steps,
    });
  }

  return buildBandChainProtocol(normalized, engine);
}

function inferProtocolTitle(normalized: string): string {
  const titleMatch = normalized.match(
    /(?:create|build|make|design)\s+(?:a\s+)?(.{0,48}?)(?:\s+sequence|\s+protocol|\s+journey|$)/i,
  );
  const title = titleMatch?.[1]?.trim();
  return title != null && title.length > 2 ? title : 'Custom Sequence';
}

/** Chain 2+ named bands across one total duration (e.g. alpha→theta→delta over 45 min). */
function buildBandChainProtocol(normalized: string, engine: EngineMode): SessionProtocol | null {
  const targets = extractOrderedBandTargets(normalized);
  const totalSec = inferTargetTotalSecFromPrompt(normalized);
  if (targets.length < 2 || totalSec == null) {
    return null;
  }

  const fadeSec = /\b(exact(?:ly)?|precise(?:ly)?)\b/i.test(normalized) ? 0 : 30;
  const playableSec = Math.max(totalSec - fadeSec, targets.length - 1);
  const stepSec = Math.max(playableSec / (targets.length - 1), 1);

  const steps = targets.slice(0, -1).map((start, i) => {
    const end = targets[i + 1];
    return buildStep(
      {
        durationSec: stepSec,
        startBeatHz: start.hz,
        endBeatHz: end.hz,
        curve: end.hz < start.hz ? 'logarithmic' : 'linear',
        label: `${start.label}→${end.label}`,
      },
      engine,
      i,
    );
  });

  return mergeFadeOut(normalized, {
    id: `ai-chain-${Date.now()}`,
    title: inferProtocolTitle(normalized),
    description: `${targets.map(t => t.label).join(' → ')}, ${Math.round(totalSec / 60)} min total.`,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: steps[steps.length - 1]?.endGain ?? 0.35,
    fadeOutEndGain: 0.04,
    steps,
  });
}

function parseGlide(chunk: string): {start: number; end: number; curve: RampCurve} | null {
  const bandGlide = parseBandGlide(chunk);
  if (bandGlide != null) {
    return bandGlide;
  }

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
  const durations = collectDurationSecMentions(normalized);
  const bands = extractOrderedBandTargets(normalized);
  return (
    durations.length > 0 ||
    bands.length >= 2 ||
    /(\d+(?:\.\d+)?)\s*(?:hz|hertz)\b/i.test(normalized) ||
    /\bat\s+\d+(?:\.\d+)?\b/i.test(normalized) ||
    /\d+\s*(?:to|→|->)\s*\d+/i.test(normalized) ||
    FUZZY_DURATIONS.some(f => f.re.test(normalized))
  );
}

function parseExplicitProtocolFromText(prompt: string, engine: EngineMode): SessionProtocol | null {
  const normalized = normalizeConversationForParsing(prompt);
  const bandTargets = extractOrderedBandTargets(normalized);
  if (bandTargets.length >= 3 && inferTargetTotalSecFromPrompt(normalized) != null) {
    const chain = buildBandChainProtocol(normalized, engine);
    if (chain != null) {
      return chain;
    }
  }

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
    return mergeFadeOut(normalized, {
      id: `ai-parsed-${Date.now()}`,
      title: inferProtocolTitle(normalized),
      description: 'Built from your explicit timings and frequencies.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: steps[steps.length - 1]?.endGain ?? 0.35,
      fadeOutEndGain: 0.04,
      steps,
    });
  }

  const narrative = parseNarrativeJourneyFromText(prompt, engine);
  if (narrative != null) {
    return narrative;
  }

  const totalSec = inferTargetTotalSecFromPrompt(normalized);
  const glide = parseGlide(normalized);
  if (totalSec != null && glide != null) {
    return mergeFadeOut(normalized, {
      id: `ai-parsed-${Date.now()}`,
      title: inferProtocolTitle(normalized),
      description: 'Built from your requested duration and frequency journey.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: 0.35,
      fadeOutEndGain: 0.04,
      steps: [
        buildStep(
          {
            durationSec: totalSec,
            startBeatHz: glide.start,
            endBeatHz: glide.end,
            curve: glide.curve,
          },
          engine,
          0,
        ),
      ],
    });
  }
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
    const inferredHz = inferBeatHzFromPrompt(normalized);
    if (inferredHz == null) {
      return null;
    }
    return mergeFadeOut(normalized, {
      id: `ai-parsed-${Date.now()}`,
      title: inferProtocolTitle(normalized),
      description: 'Built from your requested duration and inferred brainwave target.',
      stopAfterSec: 0,
      stopAfterPlayback: true,
      fadeOutDurationSec: 30,
      fadeOutStartGain: 0.35,
      fadeOutEndGain: 0.04,
      steps: [
        buildStep(
          {
            durationSec: totalSec,
            startBeatHz: inferredHz,
            endBeatHz: inferredHz,
            curve: 'linear',
            label: `${inferredHz} Hz hold`,
          },
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
