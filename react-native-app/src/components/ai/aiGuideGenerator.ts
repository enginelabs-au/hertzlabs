import {BRAINWAVE_BANDS} from '../ReadoutPanel/brainwaveBands';
import type {ChatTurn} from '../../ai/aiPromptParsing';
import {
  adjustHzFromRelativeCues,
  extractTargetHzFromPrompt,
  getLastAppliedHz,
  isFollowUpPrompt,
} from '../../ai/aiPromptParsing';
import {geminiGuideRecommendation, clearOutageAfterSuccessfulFallback, getGeminiOutageReason, geminiUnavailableExplanation, isTransientGeminiOutage, resetGeminiOutageForRetry} from '../../ai/geminiChatClient';
import {inferBeatHzFromPrompt} from '../../ai/parseProtocolFromPrompt';
import {buildExperientialGuide, classifyExperientialIntent} from '../../ai/experientialIntent';
import {promptMentionsCarrierOrPitch, sanitizeBeatHzFromModel, parseCarrierHzFromPrompt} from '../../ai/beatHzSanitize';
import type {EngineMode} from '../../state/types';
import type {GuideAdvancedSettings} from '../../state/slices/aiChat';

const GUIDE_ENGINE_MODES: EngineMode[] = [
  'binaural',
  'monaural',
  'isochronic',
  'hemisphericSync',
  'phaseModulated',
  'pitchPanning',
];
const NOISE_LAYER_VALUES = ['none', 'white', 'pink', 'brown'] as const;

export interface SessionRecommendation {
  brainwaveState: string;
  targetFrequencyHz: number;
  targetedBrainRegions: string[];
  entrainmentStyle: 'Binaural' | 'Isochronic' | 'Monaural';
  intensityScale: number;
  explanationShort: string;
  /** Optional explicit engine mode (overrides entrainmentStyle when set). */
  engineMode?: EngineMode;
  /** Optional advanced engine settings; only present keys are applied. */
  advanced?: GuideAdvancedSettings;
}

export type GuideGenerationOptions = {
  history?: ChatTurn[];
  currentBeatHz?: number;
  currentGain?: number;
  carrierHz?: number;
  engineType?: string;
  experimental?: boolean;
  premium?: boolean;
};

interface IntentProfile {
  id: string;
  keywords: string[];
  rec: SessionRecommendation;
}

const INTENT_PROFILES: IntentProfile[] = [
  {
    id: 'sleep',
    keywords: ['sleep', 'insomnia', 'asleep', 'bedtime', 'drift off', 'deep rest', 'pass out', 'nighttime', 'cant sleep', "can't sleep"],
    rec: {
      brainwaveState: 'Delta', targetFrequencyHz: 2.5,
      targetedBrainRegions: ['Thalamus', 'Default Mode Network'],
      entrainmentStyle: 'Binaural', intensityScale: 0.3,
      explanationShort: 'Delta at 2.5 Hz supports deep, restorative sleep onset and helps quiet cortical arousal.',
    },
  },
  {
    id: 'nap',
    keywords: ['nap', 'power nap', 'quick rest', 'short rest', 'recharge'],
    rec: {
      brainwaveState: 'Theta', targetFrequencyHz: 4.5,
      targetedBrainRegions: ['Thalamus', 'Parietal Lobe'],
      entrainmentStyle: 'Binaural', intensityScale: 0.35,
      explanationShort: 'A light theta dip at 4.5 Hz eases you into a brief restorative nap without deep-sleep grogginess.',
    },
  },
  {
    id: 'anxiety',
    keywords: ['anxiety', 'anxious', 'panic', 'nervous', 'overwhelm', 'worry', 'worried', 'stress', 'stressed', 'tense', 'tension', 'racing thoughts'],
    rec: {
      brainwaveState: 'Alpha', targetFrequencyHz: 8.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Limbic System'],
      entrainmentStyle: 'Binaural', intensityScale: 0.35,
      explanationShort: 'Low alpha around 8 Hz encourages a calmer, settled state and helps ease an over-active, anxious mind.',
    },
  },
  {
    id: 'relax',
    keywords: ['relax', 'unwind', 'de-stress', 'destress', 'calm', 'chill', 'soothe', 'wind down', 'decompress', 'ease', 'peace', 'peaceful'],
    rec: {
      brainwaveState: 'Alpha', targetFrequencyHz: 9.5,
      targetedBrainRegions: ['Occipital Lobe', 'Prefrontal Cortex'],
      entrainmentStyle: 'Binaural', intensityScale: 0.4,
      explanationShort: 'Alpha near 9.5 Hz promotes relaxed, wakeful calm — a good wind-down without drifting toward sleep.',
    },
  },
  {
    id: 'meditate',
    keywords: ['meditat', 'mindful', 'zen', 'spiritual', 'breathwork', 'grounding', 'grounded', 'presence', 'inner', 'introspect', 'centering'],
    rec: {
      brainwaveState: 'Theta', targetFrequencyHz: 6.0,
      targetedBrainRegions: ['Anterior Cingulate', 'Hippocampus'],
      entrainmentStyle: 'Binaural', intensityScale: 0.4,
      explanationShort: 'Theta at 6 Hz is the classic meditative range — inward awareness with reduced analytical chatter.',
    },
  },
  {
    id: 'lucid',
    keywords: ['lucid', 'dream', 'dreaming', 'hypnagog', 'visualization', 'visualisation'],
    rec: {
      brainwaveState: 'Theta', targetFrequencyHz: 5.0,
      targetedBrainRegions: ['Occipital Lobe', 'Temporal Lobe'],
      entrainmentStyle: 'Binaural', intensityScale: 0.4,
      explanationShort: 'Theta at 5 Hz sits near the dream/hypnagogic threshold often associated with vivid imagery and lucid practice.',
    },
  },
  {
    id: 'creativity',
    keywords: ['creativ', 'art', 'artistic', 'brainstorm', 'idea', 'ideas', 'write', 'writing', 'design', 'imagination', 'imagine', 'music', 'paint', 'compose'],
    rec: {
      brainwaveState: 'Alpha', targetFrequencyHz: 10.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Default Mode Network'],
      entrainmentStyle: 'Binaural', intensityScale: 0.5,
      explanationShort: 'Alpha at 10 Hz balances relaxation with open awareness — a sweet spot for creative, associative thinking.',
    },
  },
  {
    id: 'flow',
    keywords: ['flow', 'in the zone', 'deep work', 'immersive', 'absorbed'],
    rec: {
      brainwaveState: 'Alpha', targetFrequencyHz: 12.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Parietal Lobe'],
      entrainmentStyle: 'Binaural', intensityScale: 0.5,
      explanationShort: 'The alpha–beta border near 12 Hz blends calm and engagement, often described as an effortless flow state.',
    },
  },
  {
    id: 'focus',
    keywords: ['focus', 'concentrate', 'concentration', 'study', 'studying', 'work', 'working', 'productiv', 'coding', 'code', 'exam', 'attention', 'task', 'deadline', 'read', 'reading', 'homework', 'adhd', 'hyper-focus', 'hyperfocus'],
    rec: {
      brainwaveState: 'Beta', targetFrequencyHz: 14.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Dorsolateral PFC'],
      entrainmentStyle: 'Binaural', intensityScale: 0.55,
      explanationShort: 'Low beta (SMR) around 14 Hz supports calm, sustained concentration without over-stimulation.',
    },
  },
  {
    id: 'memory',
    keywords: ['memory', 'memorize', 'memorise', 'recall', 'learn', 'learning', 'cognition', 'cognitive', 'sharp', 'clarity', 'mental clarity', 'process'],
    rec: {
      brainwaveState: 'Gamma', targetFrequencyHz: 40.0,
      targetedBrainRegions: ['Hippocampus', 'Prefrontal Cortex'],
      entrainmentStyle: 'Monaural', intensityScale: 0.6,
      explanationShort: 'Gamma at 40 Hz is associated with binding and high-level cognitive processing, learning, and recall.',
    },
  },
  {
    id: 'epsilon',
    keywords: ['epsilon', 'infra-slow', 'nervous system', 'recovery', 'deep recovery', 'reset', 'nervous'],
    rec: {
      brainwaveState: 'Epsilon', targetFrequencyHz: 0.5,
      targetedBrainRegions: ['Thalamus', 'Default Mode Network'],
      entrainmentStyle: 'Binaural', intensityScale: 0.25,
      explanationShort: 'Epsilon (infra-slow, ~0.5 Hz) supports deep nervous system recovery and autonomic reset.',
    },
  },
  {
    id: 'lambda',
    keywords: ['lambda', 'hyper-gamma', 'hypergamma', 'supra', 'supra-gamma', 'supragamma', 'high gamma', 'ultra-high', 'intense processing'],
    rec: {
      brainwaveState: 'Lambda', targetFrequencyHz: 100.0,
      targetedBrainRegions: ['Prefrontal Cortex', 'Parietal Lobe'],
      entrainmentStyle: 'Monaural', intensityScale: 0.65,
      explanationShort: 'Lambda/Hyper-Gamma (100 Hz+) is associated with intense cognitive engagement and peak-state processing.',
    },
  },
  {
    id: 'energy',
    keywords: ['energy', 'energize', 'energise', 'wake', 'awake', 'alert', 'motivat', 'workout', 'exercise', 'gym', 'run', 'running', 'training', 'pump', 'active', 'boost'],
    rec: {
      brainwaveState: 'Beta', targetFrequencyHz: 20.0,
      targetedBrainRegions: ['Frontal Lobe', 'Prefrontal Cortex'],
      entrainmentStyle: 'Isochronic', intensityScale: 0.7,
      explanationShort: 'High beta at 20 Hz promotes alertness and drive — a stimulating backdrop for energy and movement.',
    },
  },
  {
    id: 'pain',
    keywords: ['pain', 'headache', 'migraine', 'ache', 'sore', 'discomfort', 'relief'],
    rec: {
      brainwaveState: 'Alpha', targetFrequencyHz: 10.0,
      targetedBrainRegions: ['Occipital Lobe', 'Prefrontal Cortex'],
      entrainmentStyle: 'Binaural', intensityScale: 0.4,
      explanationShort: 'A gentle alpha state at 10 Hz is widely used for relaxation; keep the volume low and stop if anything feels worse.',
    },
  },
];

const DEFAULT_PROFILE: IntentProfile = {
  id: 'balance',
  keywords: [],
  rec: {
    brainwaveState: 'Alpha', targetFrequencyHz: 10.0,
    targetedBrainRegions: ['Prefrontal Cortex', 'Occipital Lobe'],
    entrainmentStyle: 'Binaural', intensityScale: 0.45,
    explanationShort: 'A balanced alpha state at 10 Hz is a versatile, gentle default for relaxed, present-focused awareness.',
  },
};

function sessionBeatHz(options: GuideGenerationOptions): number {
  return options.currentBeatHz ?? 10;
}

const STRONGER_CUES = ['intense', 'strong', 'strongly', 'maximum', 'powerful', 'louder', 'increase'];
const GENTLER_CUES = ['gentle', 'subtle', 'mild', 'slight', 'soft', 'little', 'easy', 'quieter', 'decrease'];
const SPEAKER_CUES = ['speaker', 'speakers', 'out loud', 'without headphones', 'no headphones'];
const PULSE_CUES = ['isochronic', 'pulse', 'pulsing', 'rhythmic'];

const ENTRAINMENT_STYLES = ['Binaural', 'Isochronic', 'Monaural'] as const;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary aware so substrings (e.g. "network") don't falsely match "work". */
function countHits(haystack: string, needles: string[]): number {
  return needles.reduce((n, k) => {
    const re = new RegExp(`\\b${escapeRegex(k)}`, 'i');
    return re.test(haystack) ? n + 1 : n;
  }, 0);
}

function pickProfileFromPrompt(prompt: string): {profile: IntentProfile; score: number} {
  const lower = ` ${prompt.toLowerCase()} `;
  let best = DEFAULT_PROFILE;
  let bestScore = 0;
  for (const profile of INTENT_PROFILES) {
    const score = countHits(lower, profile.keywords);
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }
  return {profile: best, score: bestScore};
}

function recommendationWhenGeminiUnavailable(baseHz: number, reason: NonNullable<ReturnType<typeof getGeminiOutageReason>>): SessionRecommendation {
  return {
    brainwaveState: bandForHz(baseHz),
    targetFrequencyHz: baseHz,
    targetedBrainRegions: ['Prefrontal Cortex', 'Occipital Lobe'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.45,
    explanationShort: geminiUnavailableExplanation(reason),
  };
}

function recommendationWhenUnclear(prompt: string, baseHz: number): SessionRecommendation {
  return {
    brainwaveState: bandForHz(baseHz),
    targetFrequencyHz: baseHz,
    targetedBrainRegions: ['Prefrontal Cortex', 'Occipital Lobe'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.45,
    explanationShort:
      `I couldn't confidently map that to a specific entrainment target, so your session stays at ${baseHz.toFixed(1)} Hz. ` +
      'Try naming a band (alpha, theta, beta, delta), an exact Hz, or a timed sequence (e.g. "20 min alpha then glide to theta").',
  };
}

function bandForHz(hz: number): string {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band.label;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1].label;
}

function recommendationFromExplicitHz(hz: number, prompt: string): SessionRecommendation {
  const clamped = clamp(hz, 0.1, 500);
  return {
    brainwaveState: bandForHz(clamped),
    targetFrequencyHz: clamped,
    targetedBrainRegions: ['Prefrontal Cortex', 'Occipital Lobe'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.45,
    explanationShort: `Set to ${clamped.toFixed(2)} Hz as you requested${prompt.length > 0 ? '' : '.'}.`,
  };
}

function applyPromptModifiers(rec: SessionRecommendation, prompt: string): SessionRecommendation {
  const lower = ` ${prompt.toLowerCase()} `;
  const out = {...rec, targetedBrainRegions: [...rec.targetedBrainRegions]};

  if (countHits(lower, STRONGER_CUES) > 0) {
    out.intensityScale = clamp(out.intensityScale + 0.15, 0.15, 0.95);
  }
  if (countHits(lower, GENTLER_CUES) > 0) {
    out.intensityScale = clamp(out.intensityScale - 0.15, 0.15, 0.95);
  }
  if (countHits(lower, SPEAKER_CUES) > 0) {
    out.entrainmentStyle = 'Monaural';
  } else if (countHits(lower, PULSE_CUES) > 0) {
    out.entrainmentStyle = 'Isochronic';
  }

  out.targetFrequencyHz = clamp(out.targetFrequencyHz, 0.1, 500);
  out.intensityScale = clamp(out.intensityScale, 0, 1);
  return out;
}

function readFiniteNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Extract the optional advanced engine settings the model may include. */
function parseGuideAdvanced(
  obj: Record<string, unknown>,
  prompt: string,
): GuideAdvancedSettings | undefined {
  const adv: GuideAdvancedSettings = {};
  const mentionsCarrier = promptMentionsCarrierOrPitch(prompt);

  const carrierHz = readFiniteNumber(obj, 'carrierHz');
  if (carrierHz != null && mentionsCarrier) {
    adv.carrierHz = Math.min(Math.max(carrierHz, 20), 20_000);
  }
  const phaseAngle = readFiniteNumber(obj, 'phaseAngle');
  if (phaseAngle != null) {
    adv.phaseAngle = phaseAngle;
  }
  const leftDriftHz = readFiniteNumber(obj, 'leftDriftHz');
  if (leftDriftHz != null) {
    adv.leftDriftHz = leftDriftHz;
  }
  const rightDriftHz = readFiniteNumber(obj, 'rightDriftHz');
  if (rightDriftHz != null) {
    adv.rightDriftHz = rightDriftHz;
  }
  const balance = readFiniteNumber(obj, 'balance');
  if (balance != null) {
    adv.balance = balance;
  }
  const noiseMix = readFiniteNumber(obj, 'noiseMix');
  if (noiseMix != null) {
    adv.noiseMix = clamp(noiseMix, 0, 1);
  }
  if (NOISE_LAYER_VALUES.includes(obj.noiseLayer as (typeof NOISE_LAYER_VALUES)[number])) {
    adv.noiseLayer = obj.noiseLayer as GuideAdvancedSettings['noiseLayer'];
  }
  return Object.keys(adv).length > 0 ? adv : undefined;
}

function parseGeminiGuidePayload(raw: unknown, prompt: string): SessionRecommendation | null {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const hzRaw = obj.targetFrequencyHz;
  const explanation = obj.explanationShort;
  const hzSanitized = sanitizeBeatHzFromModel(hzRaw);
  if (hzSanitized == null || typeof explanation !== 'string') {
    return null;
  }
  const style = obj.entrainmentStyle;
  const entrainmentStyle = ENTRAINMENT_STYLES.includes(style as (typeof ENTRAINMENT_STYLES)[number])
    ? (style as SessionRecommendation['entrainmentStyle'])
    : 'Binaural';
  const regions = Array.isArray(obj.targetedBrainRegions)
    ? obj.targetedBrainRegions.filter((r): r is string => typeof r === 'string')
    : ['Prefrontal Cortex'];
  const intensity =
    typeof obj.intensityScale === 'number' && Number.isFinite(obj.intensityScale)
      ? clamp(obj.intensityScale, 0, 1)
      : 0.45;
  const engineMode = GUIDE_ENGINE_MODES.includes(obj.engineMode as EngineMode)
    ? (obj.engineMode as EngineMode)
    : undefined;

  return applyPromptModifiers(
    {
      brainwaveState: typeof obj.brainwaveState === 'string' ? obj.brainwaveState : bandForHz(hzSanitized),
      targetFrequencyHz: hzSanitized,
      targetedBrainRegions: regions.length > 0 ? regions : ['Prefrontal Cortex'],
      entrainmentStyle,
      intensityScale: intensity,
      explanationShort: explanation,
      engineMode,
      advanced: parseGuideAdvanced(obj, prompt),
    },
    '',
  );
}

function generateGuidanceLocal(
  prompt: string,
  options: GuideGenerationOptions,
): SessionRecommendation {
  const history = options.history ?? [];
  const baseHz = getLastAppliedHz(history, sessionBeatHz(options));

  const explicit = extractTargetHzFromPrompt(prompt);
  if (explicit != null) {
    return applyPromptModifiers(recommendationFromExplicitHz(explicit, prompt), prompt);
  }

  const relative = adjustHzFromRelativeCues(prompt, baseHz);
  if (relative != null && (isFollowUpPrompt(prompt) || history.length > 0)) {
    return applyPromptModifiers(recommendationFromExplicitHz(relative, prompt), prompt);
  }

  const experiential = classifyExperientialIntent(prompt);
  if (experiential != null) {
    const g = buildExperientialGuide(experiential.id, prompt);
    return applyPromptModifiers(
      {
        brainwaveState: g.brainwaveState,
        targetFrequencyHz: g.targetFrequencyHz,
        targetedBrainRegions: g.targetedBrainRegions,
        entrainmentStyle: g.entrainmentStyle,
        intensityScale: g.intensityScale,
        explanationShort: g.explanationShort,
        engineMode: g.engineMode,
      },
      prompt,
    );
  }

  const inferred = inferBeatHzFromPrompt(prompt);
  if (inferred != null) {
    const rec = recommendationFromExplicitHz(inferred, prompt);
    rec.explanationShort = `Mapped your request to ${rec.brainwaveState} around ${inferred.toFixed(1)} Hz based on the bands and states you described.`;
    return applyPromptModifiers(rec, prompt);
  }

  const {profile, score} = pickProfileFromPrompt(prompt);
  if (score > 0) {
    const rec: SessionRecommendation = {...profile.rec, targetedBrainRegions: [...profile.rec.targetedBrainRegions]};
    return applyPromptModifiers(rec, prompt);
  }

  return applyPromptModifiers(recommendationWhenUnclear(prompt, baseHz), prompt);
}

export function getBandColor(hz: number): string {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band.hexColor;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1].hexColor;
}

export function formatRecommendationMessage(rec: SessionRecommendation): string {
  return [
    rec.explanationShort,
    '',
    `${rec.brainwaveState} · ${rec.targetFrequencyHz.toFixed(2)} Hz`,
    `${rec.entrainmentStyle} · ${(rec.intensityScale * 100).toFixed(0)}% intensity`,
    `Regions: ${rec.targetedBrainRegions.join(', ')}`,
    '',
    '→ Applied to your live session. Keep chatting to refine.',
  ].join('\n');
}

/** Gemini when configured; otherwise smart local parsing (latest prompt wins). */
export async function generateGuidance(
  prompt: string,
  options: GuideGenerationOptions = {},
): Promise<SessionRecommendation> {
  const history = options.history ?? [];
  const trimmed = prompt.trim();
  if (!trimmed) {
    return recommendationWhenUnclear('', sessionBeatHz(options));
  }

  // kHz/MHz pitch requests are carrier changes — route before Gemini can confuse them with beat Hz.
  const carrierFromPrompt = parseCarrierHzFromPrompt(trimmed);
  if (carrierFromPrompt != null) {
    const beat =
      sanitizeBeatHzFromModel(extractTargetHzFromPrompt(trimmed)) ?? sessionBeatHz(options);
    clearOutageAfterSuccessfulFallback();
    return applyPromptModifiers(
      {
        brainwaveState: bandForHz(beat),
        targetFrequencyHz: beat,
        targetedBrainRegions: ['Auditory Cortex'],
        entrainmentStyle: 'Binaural',
        intensityScale: 0.45,
        explanationShort: `Set carrier pitch to ${(carrierFromPrompt / 1000).toFixed(1)} kHz while keeping entrainment at ${beat.toFixed(1)} Hz.`,
        advanced: {carrierHz: carrierFromPrompt},
      },
      trimmed,
    );
  }

  const priorOutage = getGeminiOutageReason();
  if (isTransientGeminiOutage(priorOutage)) {
    resetGeminiOutageForRetry();
  }

  const geminiRaw =
    getGeminiOutageReason() == null
      ? await geminiGuideRecommendation(history, trimmed, {
          beatHz: options.currentBeatHz ?? sessionBeatHz(options),
          carrierHz: options.carrierHz ?? 220,
          gain: options.currentGain ?? 0.45,
          engineType: options.engineType ?? 'binaural',
          experimental: options.experimental ?? false,
          premium: options.premium ?? false,
        })
      : null;

  const parsed = geminiRaw != null ? parseGeminiGuidePayload(geminiRaw, trimmed) : null;
  if (parsed != null) {
    return applyPromptModifiers(parsed, trimmed);
  }

  const outage = getGeminiOutageReason();
  if (outage != null) {
    return recommendationWhenGeminiUnavailable(sessionBeatHz(options), outage);
  }

  await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
  return applyPromptModifiers(generateGuidanceLocal(trimmed, options), trimmed);
}
