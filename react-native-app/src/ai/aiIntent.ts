import type {ChatTurn} from './aiPromptParsing';
import {
  buildUserConversationText,
  collectDurationSecMentions,
  extractOrderedBandTargets,
  conversationHasExplicitSequenceNumbers,
  extractTargetHzFromConversationText,
  normalizeConversationForParsing,
} from './parseProtocolFromPrompt';

const SEQUENCE_CUES = [
  'sequence',
  'protocol',
  'journey',
  'progression',
  'over time',
  'step by step',
  'gradual',
  'ramp down',
  'ramp up',
  'wind down',
  'induction',
  'timeline',
  'chain',
  'multi-step',
  'multistep',
  'multi step',
  'minutes then',
  'min then',
  'then go',
  'then drop',
  'transition',
  'schedule',
  'program',
  'fade out',
  'fade to silence',
  'stages',
  'phases',
  // Sweep / scale traversal
  'sweep',
  'sweeping',
  'sweep down',
  'sweep up',
  'sweep through',
  'scale down',
  'scale up',
  'scaling down',
  'scaling up',
  // Directional descent/ascent
  'descend',
  'descending',
  'ascend',
  'ascending',
  'going down to',
  'going up to',
  'slide down',
  'slide up',
  'drift down',
  'drift up',
  'count down',
  'countdown',
  // Time-based journey phrasing
  'over the course',
  'over the next',
  'across the range',
  'across the spectrum',
  // Range/endpoint traversal
  'high to low',
  'low to high',
  'from high',
  'from low',
  'from highest',
  'from lowest',
  'highest to lowest',
  'lowest to highest',
  'full range',
  'full spectrum',
  // Journey start/end markers
  'starting at',
  'starting from',
  'start at',
  'start from',
  'begin at',
  'ending at',
  'end at',
  // Session/automation phrasing
  'cycle between',
  'alternate between',
  'loop through',
  'rotate through',
  // Round-trip / arc patterns
  'up and down',
  'up then down',
  'down and up',
  'down then up',
  'rise and fall',
  'fall and rise',
  'back and forth',
  'back again',
  'round trip',
  'there and back',
  'peak and return',
  // Full range coverage
  'full sweep',
  'full range',
  'full spectrum',
  'full scan',
  'going up',
  'going down',
  'going higher',
  'going lower',
  // Follow-up modification keywords
  'reverse',
  'flip it',
  'flip the',
  'other way',
  'go backwards',
  'ascending instead',
  'descending instead',
  'now ascending',
  'now descending',
];

function textHasSequenceCue(text: string): boolean {
  const lower = text.toLowerCase();
  return SEQUENCE_CUES.some(c => lower.includes(c));
}

/**
 * True when the user wants a timed multi-step (or timed hold) frequency journey —
 * not a single static formula.
 */
export function wantsProtocolSequence(history: ChatTurn[], latest: string): boolean {
  const trimmed = latest.trim();
  if (!trimmed) {
    return false;
  }

  const latestNorm = normalizeConversationForParsing(trimmed);
  if (extractOrderedBandTargets(latestNorm).length >= 2 && collectDurationSecMentions(latestNorm).length > 0) {
    return true;
  }

  const userText = buildUserConversationText(history, trimmed);
  const norm = normalizeConversationForParsing(userText);

  if (textHasSequenceCue(norm)) {
    return true;
  }

  if (/\b(multi[\s-]?step|steps?\s+\d|phase\s+\d|stage\s+\d)\b/i.test(norm)) {
    return true;
  }

  if (/\b(ramp(?:ing)?|glide|gliding|transition(?:ing)?|wind(?:ing)?\s+down|stepping\s+down)\b/i.test(norm)) {
    return true;
  }

  // Sweep/traverse pattern: "sweep/slide/scale/descend from X to Y" or "X → Y over time"
  if (/\b(sweep|slide|traverse|scan|scale|descend|ascend)\b/i.test(norm)) {
    return true;
  }

  // Round-trip / arc: "going up then down", "up and down", "back and forth"
  if (
    /\b(up\s+(?:and|then|&)\s+down|down\s+(?:and|then|&)\s+up)\b/i.test(norm) ||
    /\b(rise\s+(?:and|then)\s+fall|ascend\s+(?:and|then)\s+descend)\b/i.test(norm) ||
    /\b(back\s+(?:and\s+forth|again)|round[\s-]trip|there\s+and\s+back)\b/i.test(norm)
  ) {
    return true;
  }

  if (/\b(hold|stay|maintain|keep).{0,40}\bfor\b.{0,20}\b(min|sec|second|hour|hr)\b/i.test(norm)) {
    return true;
  }

  if (/\b\d+.{0,24}\b(min|minute|sec|second|hour|hr)\b.{0,24}\b(then|→|->)\b/i.test(norm)) {
    return true;
  }

  if (/\b(then|→|->).{0,24}\b\d+.{0,12}\b(min|minute|sec|second|hour|hr)\b/i.test(norm)) {
    return true;
  }

  // "from [X] to [Y]" traversal with a duration anywhere in the message
  if (/\bfrom\b.{2,60}\bto\b/i.test(norm) && /\b\d+\s*(min|sec|second|hour|hr)\b/i.test(norm)) {
    return true;
  }

  const durations = collectDurationSecMentions(norm);

  // hasHz: explicit value, band name, or relational/directional frequency language
  const hasRelationalHz =
    /\b(highest|lowest|maximum|minimum|max|min|upper|lower|top|bottom)\b/i.test(norm) &&
    /\b(freq(?:uency)?|hz|hertz|range|band)\b/i.test(norm);

  const hasHz =
    extractTargetHzFromConversationText(norm) != null ||
    /\b(alpha|beta|theta|delta|gamma|epsilon|lambda|smr)\b/i.test(norm) ||
    hasRelationalHz;

  if (durations.length > 0 && hasHz) {
    return true;
  }

  if (/\b(design|create|build|make|program|load|start|show)\b/i.test(norm) && durations.length > 0) {
    return true;
  }

  if (/\bfade\s+out\b/i.test(norm) && durations.length > 0) {
    return true;
  }

  const priorSequence = history.some(t => t.role === 'user' && textHasSequenceCue(t.text));
  if (priorSequence && conversationHasExplicitSequenceNumbers(history, trimmed)) {
    return true;
  }

  return false;
}

export function isSequenceRequest(prompt: string): boolean {
  return wantsProtocolSequence([], prompt);
}

export function isSequenceRequestInConversation(history: ChatTurn[], latest: string): boolean {
  return wantsProtocolSequence(history, latest);
}
