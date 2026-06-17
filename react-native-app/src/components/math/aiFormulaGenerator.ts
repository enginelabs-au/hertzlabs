import type {ChatTurn} from '../../ai/aiPromptParsing';
import {wantsProtocolSequence} from '../../ai/aiIntent';
import {
  adjustHzFromRelativeCues,
  extractTargetHzFromPrompt,
  getLastAppliedHz,
  isFollowUpPrompt,
} from '../../ai/aiPromptParsing';
import {geminiFormulaResponse} from '../../ai/geminiChatClient';
import type {MathFormulaContext} from './evaluateMathFormula';
import {evaluateMathFormula} from './evaluateMathFormula';
import {MAX_BEAT_HZ} from '../../audio/paramMapping';

export type AIFormulaChip = {
  label: string;
  prompt: string;
};

export const AI_FORMULA_CHIPS: AIFormulaChip[] = [
  {
    label: 'DMT experience',
    prompt: 'What does a DMT experience feel like in brainwave terms?',
  },
  {
    label: 'Near-death pattern',
    prompt: 'What pattern does the brain experience during death?',
  },
  {
    label: 'Visual cortex',
    prompt: 'What frequencies can stimulate the visual cortex?',
  },
  {
    label: 'Flow state',
    prompt: 'What mathematical pattern matches effortless flow state?',
  },
  {
    label: 'Schumann lock',
    prompt: 'How do I entrain to the Earth ionosphere cavity resonance?',
  },
  {
    label: 'Sleep sequence',
    prompt: 'Design a 45 minute sleep sequence that ramps from alpha to delta',
  },
  {
    label: 'Theta journey',
    prompt: 'Create a multi-step theta meditation sequence over 30 minutes',
  },
];

type FormulaProfile = {
  keywords: string[];
  formula: string;
  reply: string;
};

const FORMULA_PROFILES: FormulaProfile[] = [
  {
    keywords: ['dmt', 'psychedelic', 'ayahuasca', 'psilocybin', '5-meo'],
    formula: '4.5 + φ ** 2',
    reply:
      'DMT-like states often blend theta imagery (~4–8 Hz) with brief gamma bursts. Try a theta base scaled by φ² for a harmonic stack.',
  },
  {
    keywords: ['near-death', 'near death', 'nde', 'dying', 'death experience'],
    formula: '7.83 / 3',
    reply:
      'Reports of near-death states describe ultra-slow delta slowing. A Schumann-scaled sub-harmonic models that deep deceleration.',
  },
  {
    keywords: ['visual cortex', 'phosphene', 'visual', 'phosphenes', 'occipital'],
    formula: '40',
    reply:
      'Visual cortex binding is associated with gamma-band activity near 40 Hz. Applying 40 Hz targets that integrative band.',
  },
  {
    keywords: ['flow', 'in the zone', 'creative', 'immersed', 'creativity'],
    formula: '10 + φ',
    reply:
      'Flow sits between relaxed alpha and engaged beta. Alpha peak plus φ gives a proportional step into open focus.',
  },
  {
    keywords: ['schumann', 'ionosphere', '7.83', 'earth resonance'],
    formula: '7.83',
    reply: 'The primary Schumann resonance at 7.83 Hz is the baseline Earth–ionosphere cavity mode.',
  },
  {
    keywords: ['sleep', 'insomnia', 'deep rest', 'slow wave', 'slow-wave'],
    formula: '2.5',
    reply: 'Deep sleep onset aligns with delta around 2–4 Hz. A 2.5 Hz target supports slow-wave entrainment.',
  },
  {
    keywords: ['anxiety', 'calm', 'stress', 'panic', 'relax', 'soothe'],
    formula: '|f_L - f_R| * 0.8',
    reply:
      'Gentle alpha entrainment slightly below your current beat differential can soften arousal without losing the binaural lock.',
  },
  {
    keywords: ['focus', 'adhd', 'study', 'concentrat', 'attention', 'deep work', 'productiv'],
    formula: '14',
    reply: 'SMR/low-beta near 14 Hz supports sustained attention — a common focus entrainment target.',
  },
  {
    keywords: ['lucid', 'dream', 'hypnagog'],
    formula: '5 + φ / 2',
    reply: 'Lucid hypnagogia sits in low theta. A φ-scaled offset from 5 Hz models the dream threshold.',
  },
  {
    keywords: ['meditat', 'mindful', 'zen', 'presence'],
    formula: '6',
    reply: 'Classic meditation entrainment centers on 6 Hz theta — inward awareness with reduced analytical chatter.',
  },
  {
    keywords: ['memory', 'recall', 'learning', 'cognition', 'binding'],
    formula: '40',
    reply: 'Gamma at 40 Hz is linked to feature binding, learning, and recall.',
  },
  {
    keywords: ['energy', 'energize', 'alert', 'wake up', 'motivat'],
    formula: '20',
    reply: 'High-beta near 20 Hz raises alertness and drive — a stimulating, wakeful target.',
  },
];

/** Direct brainwave-band requests → representative Hz. */
const BAND_TARGETS: {patterns: RegExp; hz: number; name: string}[] = [
  {patterns: /\b(epsilon|sub[-\s]?delta|infra[-\s]?slow)\b/i, hz: 0.5, name: 'Epsilon'},
  {patterns: /\bdelta\b/i, hz: 2.5, name: 'Delta'},
  {patterns: /\btheta\b/i, hz: 6, name: 'Theta'},
  {patterns: /\b(alpha|smr)\b/i, hz: 10, name: 'Alpha'},
  {patterns: /\bbeta\b/i, hz: 18, name: 'Beta'},
  {patterns: /\b(gamma|40\s?hz)\b/i, hz: 40, name: 'Gamma'},
  {patterns: /\b(lambda|hyper[-\s]?gamma)\b/i, hz: 100, name: 'Lambda'},
];

function detectBandTarget(prompt: string): {hz: number; reply: string} | null {
  for (const band of BAND_TARGETS) {
    if (band.patterns.test(prompt)) {
      return {
        hz: band.hz,
        reply: `Targeting the ${band.name} band at ${band.hz} Hz as requested.`,
      };
    }
  }
  return null;
}

const CLARIFY_REPLY =
  "I'd rather get this exactly right than guess. Tell me a target Hz (e.g. \"7.83 Hz\"), a band (delta, theta, alpha, beta, gamma), or a state (sleep, focus, calm, creative) and I'll derive the math.";

export type FormulaGenerationOptions = {
  history?: ChatTurn[];
  engineType?: string;
  experimental?: boolean;
  premium?: boolean;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary aware so "network"/"oversee" don't falsely hit "work"/"see". */
function countHits(haystack: string, needles: string[]): number {
  return needles.reduce((n, k) => {
    const re = new RegExp(`\\b${escapeRegex(k)}`, 'i');
    return re.test(haystack) ? n + 1 : n;
  }, 0);
}

/** Returns the best matching profile, or null when nothing is recognized. */
function pickProfileFromPrompt(prompt: string): FormulaProfile | null {
  const lower = ` ${prompt.toLowerCase()} `;
  let best: FormulaProfile | null = null;
  let bestScore = 0;
  for (const profile of FORMULA_PROFILES) {
    const score = countHits(lower, profile.keywords);
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }
  return best;
}

export type AIFormulaGeneration = {
  reply: string;
  formula: string;
  evalHz: number | null;
  bandLabel: string | null;
  error: string | null;
};

function evaluateFormulaReply(
  formula: string,
  reply: string,
  ctx: MathFormulaContext,
): AIFormulaGeneration {
  const evalResult = evaluateMathFormula(formula, ctx);
  if (!evalResult.ok) {
    return {
      reply,
      formula,
      evalHz: null,
      bandLabel: null,
      error: evalResult.error,
    };
  }
  return {
    reply,
    formula,
    evalHz: evalResult.hz,
    bandLabel: evalResult.bandLabel,
    error: null,
  };
}

function parseGeminiFormulaPayload(raw: unknown): {reply: string; formula: string} | null {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.reply !== 'string' || typeof obj.formula !== 'string' || obj.formula.trim().length === 0) {
    return null;
  }
  return {reply: obj.reply.trim(), formula: obj.formula.trim()};
}

function generateFormulaLocal(
  prompt: string,
  ctx: MathFormulaContext,
  options: FormulaGenerationOptions,
): AIFormulaGeneration {
  const history = options.history ?? [];
  const baseHz = getLastAppliedHz(history, ctx.f_beat);

  if (wantsProtocolSequence(history, prompt)) {
    return {
      reply: CLARIFY_REPLY,
      formula: '',
      evalHz: null,
      bandLabel: null,
      error: null,
    };
  }

  // 1. Explicit Hz always wins.
  const explicit = extractTargetHzFromPrompt(prompt);
  if (explicit != null && explicit <= MAX_BEAT_HZ * 12) {
    const formula = String(explicit);
    return evaluateFormulaReply(formula, `Setting target to ${explicit} Hz from your prompt.`, ctx);
  }

  // 2. Relative adjustment on a follow-up ("slower", "+3", "double").
  const relative = adjustHzFromRelativeCues(prompt, baseHz);
  if (relative != null && (isFollowUpPrompt(prompt) || history.length > 0)) {
    const formula = String(Number(relative.toFixed(4)));
    return evaluateFormulaReply(formula, `Adjusted to ${relative.toFixed(2)} Hz based on your follow-up.`, ctx);
  }

  // 3. Named brainwave band.
  const band = detectBandTarget(prompt);
  if (band != null) {
    return evaluateFormulaReply(String(band.hz), band.reply, ctx);
  }

  // 4. Recognized phenomenon/state.
  const profile = pickProfileFromPrompt(prompt);
  if (profile != null) {
    return evaluateFormulaReply(profile.formula, profile.reply, ctx);
  }

  // 5. No silent default — ask for specifics rather than jumping to "focus".
  return {reply: CLARIFY_REPLY, formula: '', evalHz: null, bandLabel: null, error: null};
}

/** Gemini when configured; otherwise smart local parsing (latest prompt wins). */
export async function generateFormulaFromPrompt(
  prompt: string,
  ctx: MathFormulaContext,
  options: FormulaGenerationOptions = {},
): Promise<AIFormulaGeneration> {
  const history = options.history ?? [];
  const trimmed = prompt.trim();
  if (!trimmed) {
    return generateFormulaLocal('f_beat', ctx, options);
  }

  if (wantsProtocolSequence(history, trimmed)) {
    return {
      reply: CLARIFY_REPLY,
      formula: '',
      evalHz: null,
      bandLabel: null,
      error: null,
    };
  }

  const geminiRaw = await geminiFormulaResponse(history, trimmed, {
    beatHz: ctx.f_beat,
    carrierHz: ctx.f_c,
    gain: 0.45,
    engineType: options.engineType ?? 'binaural',
    experimental: options.experimental ?? false,
    premium: options.premium ?? false,
    f_L: ctx.f_L,
    f_R: ctx.f_R,
    f_beat: ctx.f_beat,
    f_c: ctx.f_c,
  });

  const parsed = geminiRaw != null ? parseGeminiFormulaPayload(geminiRaw) : null;
  if (parsed != null) {
    return evaluateFormulaReply(parsed.formula, parsed.reply, ctx);
  }

  await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
  return generateFormulaLocal(trimmed, ctx, options);
}
