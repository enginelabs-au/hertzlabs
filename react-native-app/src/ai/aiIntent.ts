import type {ChatTurn} from './aiPromptParsing';
import {
  buildUserConversationText,
  collectDurationSecMentions,
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

  if (/\b(hold|stay|maintain|keep).{0,40}\bfor\b.{0,20}\b(min|sec|second|hour|hr)\b/i.test(norm)) {
    return true;
  }

  if (/\b\d+.{0,24}\b(min|minute|sec|second|hour|hr)\b.{0,24}\b(then|→|->)\b/i.test(norm)) {
    return true;
  }

  if (/\b(then|→|->).{0,24}\b\d+.{0,12}\b(min|minute|sec|second|hour|hr)\b/i.test(norm)) {
    return true;
  }

  const durations = collectDurationSecMentions(norm);
  const hasHz =
    extractTargetHzFromConversationText(norm) != null ||
    /\b(alpha|beta|theta|delta|gamma|epsilon|lambda|smr)\b/i.test(norm);

  if (durations.length > 0 && hasHz) {
    return true;
  }

  if (/\b(design|create|build|make|program|load|start)\b/i.test(norm) && durations.length > 0) {
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
