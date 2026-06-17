import type {EngineMode} from '../state/types';
import {normalizeProtocol, scaleProtocolStepsToTotalSec} from '../protocol/interpolateProtocol';
import type {ProtocolStep, RampCurve, SessionProtocol} from '../protocol/types';
import type {ChatTurn} from './aiPromptParsing';
import {inferTargetTotalSecFromConversation, normalizeConversationForParsing} from './parseProtocolFromPrompt';

/** Sentiment / phenomenology buckets — not literal Hz keywords. */
export type ExperientialIntentId =
  | 'psychedelic'
  | 'chaotic'
  | 'dynamic'
  | 'euphoric'
  | 'melancholic'
  | 'serene'
  | 'grounding'
  | 'hypnotic';

export type ExperientialMatch = {
  id: ExperientialIntentId;
  score: number;
  /** Multi-step journeys vs single live target. */
  prefersProtocol: boolean;
};

type Cluster = {pattern: RegExp; weight: number};

type IntentDef = {
  id: ExperientialIntentId;
  prefersProtocol: boolean;
  clusters: Cluster[];
  summaryGuide: string;
  summaryProtocol: string;
};

const MIN_SCORE = 2;

const INTENT_DEFS: IntentDef[] = [
  {
    id: 'psychedelic',
    prefersProtocol: true,
    summaryGuide:
      'Theta–gamma openness associated with visionary, dreamlike states — start low and let harmonics bloom.',
    summaryProtocol:
      'A layered theta → alpha → gamma → theta arc evoking expanded, dreamlike phenomenology.',
    clusters: [
      {pattern: /\b(psychedel\w*|psychadelic|trippy|hallucin\w*|visionary)\b/i, weight: 4},
      {pattern: /\b(entheogen\w*|mystical|transcendent|otherworldly|cosmic|surreal)\b/i, weight: 3},
      {pattern: /\b(dmt|lsd|shroom|psilocybin|ayahuasca|ego\s+death|fractal)\b/i, weight: 3},
      {pattern: /\b(expanded\s+consciousness|dissolv\w*|dreamlike|hypnagog\w*)\b/i, weight: 2},
    ],
  },
  {
    id: 'chaotic',
    prefersProtocol: true,
    summaryGuide:
      'High-beta / gamma turbulence — sharp, unpredictable energy; keep volume moderate.',
    summaryProtocol:
      'Alternating beta↔gamma bursts with shifting intensity — structured chaos, not a flat hold.',
    clusters: [
      {pattern: /\b(chaotic|chaos|turbulen\w*|frenetic|manic|stormy|volatile)\b/i, weight: 4},
      {pattern: /\b(unpredict\w*|wild|explosive|feral|intense\s+energy|hyperstim\w*)\b/i, weight: 3},
      {pattern: /\b(disorder\w*|erratic|tumult\w*|hurricane|whirlwind)\b/i, weight: 2},
    ],
  },
  {
    id: 'dynamic',
    prefersProtocol: true,
    summaryGuide:
      'A moving target — engagement without locking to one band.',
    summaryProtocol:
      'A varied multi-phase journey with changing bands and curves — nothing static.',
    clusters: [
      {pattern: /\b(dynamic|evolving|morphing|shifting|changing|non[\s-]?static)\b/i, weight: 4},
      {pattern: /\b(varied|progression|journey|flowing|undulating|wave[\s-]?like)\b/i, weight: 2},
      {pattern: /\b(sequence|protocol|multi[\s-]?phase|stages?|phases?)\b/i, weight: 2},
    ],
  },
  {
    id: 'euphoric',
    prefersProtocol: false,
    summaryGuide:
      'Elevated beta–gamma brightness often described as blissful or radiant uplift.',
    summaryProtocol:
      'Ascending alpha → beta → gamma lift with a gentle settle — euphoric arc.',
    clusters: [
      {pattern: /\b(euphor\w*|bliss\w*|ecstat\w*|radiant|uplift\w*|elated)\b/i, weight: 4},
      {pattern: /\b(joy\w*|celebrat\w*|euphoria|on\s+top\s+of\s+the\s+world)\b/i, weight: 3},
    ],
  },
  {
    id: 'melancholic',
    prefersProtocol: false,
    summaryGuide:
      'Low theta–delta weight — heavy, introspective tone; keep intensity gentle.',
    summaryProtocol:
      'Slow descent through alpha into theta–delta — spacious and heavy.',
    clusters: [
      {pattern: /\b(melanchol\w*|grief|sorrow|somber|brooding|heavy\s+heart)\b/i, weight: 4},
      {pattern: /\b(sadness|lonely|loneliness|mourning|blue\s+mood)\b/i, weight: 3},
    ],
  },
  {
    id: 'serene',
    prefersProtocol: false,
    summaryGuide:
      'Soft alpha calm — settled, peaceful presence without pushing toward sleep.',
    summaryProtocol:
      'Gentle alpha holds with slow theta dips — serene, unhurried.',
    clusters: [
      {pattern: /\b(serene|tranquil|blissful\s+calm|stillness|hushed)\b/i, weight: 4},
      {pattern: /\b(peaceful|gentle|soft|nurturing|soothing|quiet)\b/i, weight: 2},
    ],
  },
  {
    id: 'grounding',
    prefersProtocol: false,
    summaryGuide:
      'Low alpha–SMR anchoring — embodied, present, stabilized.',
    summaryProtocol:
      'SMR → alpha holds — earthy stabilization before release.',
    clusters: [
      {pattern: /\b(ground\w*|centered|centred|rooted|embodied|earthing)\b/i, weight: 4},
      {pattern: /\b(stabil\w*|anchor\w*|present|here\s+and\s+now)\b/i, weight: 2},
    ],
  },
  {
    id: 'hypnotic',
    prefersProtocol: true,
    summaryGuide:
      'Theta entrainment with pulsing isochronic weight — trance-like absorption.',
    summaryProtocol:
      'Theta holds with subtle gamma flicker — trance induction arc.',
    clusters: [
      {pattern: /\b(hypnot\w*|trance|mesmer\w*|spellbound|entranc\w*)\b/i, weight: 4},
      {pattern: /\b(suggestib\w*|automatic\s+flow|deep\s+absorption)\b/i, weight: 2},
    ],
  },
];

function makeStep(
  partial: Partial<ProtocolStep> &
    Pick<ProtocolStep, 'durationSec' | 'startBeatHz' | 'endBeatHz' | 'label'>,
  engine: EngineMode,
  index: number,
): ProtocolStep {
  return {
    id: partial.id ?? `exp-${index}`,
    label: partial.label,
    durationSec: partial.durationSec,
    startBeatHz: partial.startBeatHz,
    endBeatHz: partial.endBeatHz,
    curve: partial.curve ?? 'logarithmic',
    startGain: partial.startGain ?? 0.4,
    endGain: partial.endGain ?? partial.startGain ?? 0.4,
    engineMode: partial.engineMode ?? engine,
  };
}

/** Score phenomenological / sentiment language (not literal band names). */
export function classifyExperientialIntent(text: string): ExperientialMatch | null {
  const norm = normalizeConversationForParsing(text);
  if (!norm) {
    return null;
  }

  let best: ExperientialMatch | null = null;
  for (const def of INTENT_DEFS) {
    let score = 0;
    for (const {pattern, weight} of def.clusters) {
      if (pattern.test(norm)) {
        score += weight;
      }
    }
    if (score >= MIN_SCORE && (best == null || score > best.score)) {
      best = {id: def.id, score, prefersProtocol: def.prefersProtocol};
    }
  }
  return best;
}

export function experientialIntentSummary(id: ExperientialIntentId, forProtocol: boolean): string {
  const def = INTENT_DEFS.find(d => d.id === id);
  if (def == null) {
    return '';
  }
  return forProtocol ? def.summaryProtocol : def.summaryGuide;
}

export type ExperientialGuideResult = {
  brainwaveState: string;
  targetFrequencyHz: number;
  targetedBrainRegions: string[];
  entrainmentStyle: 'Binaural' | 'Isochronic' | 'Monaural';
  intensityScale: number;
  explanationShort: string;
  engineMode?: EngineMode;
};

const GUIDE_BY_INTENT: Record<ExperientialIntentId, ExperientialGuideResult> = {
  psychedelic: {
    brainwaveState: 'Theta',
    targetFrequencyHz: 6.5,
    targetedBrainRegions: ['Occipital Lobe', 'Temporal Lobe', 'Default Mode Network'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.5,
    explanationShort: INTENT_DEFS[0].summaryGuide,
  },
  chaotic: {
    brainwaveState: 'Gamma',
    targetFrequencyHz: 38,
    targetedBrainRegions: ['Frontal Lobe', 'Parietal Lobe'],
    entrainmentStyle: 'Isochronic',
    intensityScale: 0.65,
    explanationShort: INTENT_DEFS[1].summaryGuide,
    engineMode: 'isochronic',
  },
  dynamic: {
    brainwaveState: 'Alpha-Beta',
    targetFrequencyHz: 12,
    targetedBrainRegions: ['Prefrontal Cortex', 'Parietal Lobe'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.5,
    explanationShort: INTENT_DEFS[2].summaryGuide,
  },
  euphoric: {
    brainwaveState: 'Beta',
    targetFrequencyHz: 22,
    targetedBrainRegions: ['Frontal Lobe', 'Nucleus Accumbens'],
    entrainmentStyle: 'Monaural',
    intensityScale: 0.6,
    explanationShort: INTENT_DEFS[3].summaryGuide,
  },
  melancholic: {
    brainwaveState: 'Theta',
    targetFrequencyHz: 5,
    targetedBrainRegions: ['Limbic System', 'Default Mode Network'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.3,
    explanationShort: INTENT_DEFS[4].summaryGuide,
  },
  serene: {
    brainwaveState: 'Alpha',
    targetFrequencyHz: 9,
    targetedBrainRegions: ['Occipital Lobe', 'Prefrontal Cortex'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.35,
    explanationShort: INTENT_DEFS[5].summaryGuide,
  },
  grounding: {
    brainwaveState: 'SMR',
    targetFrequencyHz: 13.5,
    targetedBrainRegions: ['Somatosensory Cortex', 'Brainstem'],
    entrainmentStyle: 'Binaural',
    intensityScale: 0.4,
    explanationShort: INTENT_DEFS[6].summaryGuide,
  },
  hypnotic: {
    brainwaveState: 'Theta',
    targetFrequencyHz: 5.5,
    targetedBrainRegions: ['Thalamus', 'Anterior Cingulate'],
    entrainmentStyle: 'Isochronic',
    intensityScale: 0.45,
    explanationShort: INTENT_DEFS[7].summaryGuide,
    engineMode: 'isochronic',
  },
};

export function buildExperientialGuide(id: ExperientialIntentId, prompt: string): ExperientialGuideResult {
  const base = GUIDE_BY_INTENT[id];
  const tail = prompt.trim().length > 0 ? ' Shaped from what you described.' : '';
  return {
    ...base,
    targetedBrainRegions: [...base.targetedBrainRegions],
    explanationShort: base.explanationShort + tail,
  };
}

function scaleSteps(
  steps: ProtocolStep[],
  totalSec: number,
  fadeSec: number,
): ProtocolStep[] {
  const playable = Math.max(totalSec - fadeSec, steps.length);
  return scaleProtocolStepsToTotalSec(steps, playable);
}

function buildPsychedelicProtocol(engine: EngineMode, totalSec: number): SessionProtocol {
  const fadeSec = 30;
  const steps = scaleSteps(
    [
      makeStep(
        {label: 'Theta · open', durationSec: 600, startBeatHz: 7, endBeatHz: 5.5, curve: 'logarithmic', startGain: 0.38, endGain: 0.42},
        engine,
        0,
      ),
      makeStep(
        {label: 'Alpha · drift', durationSec: 600, startBeatHz: 5.5, endBeatHz: 10, curve: 'linear', startGain: 0.42, endGain: 0.44},
        engine,
        1,
      ),
      makeStep(
        {label: 'Gamma · bloom', durationSec: 480, startBeatHz: 10, endBeatHz: 38, curve: 'linear', startGain: 0.44, endGain: 0.52},
        engine,
        2,
      ),
      makeStep(
        {label: 'Theta · integrate', durationSec: 720, startBeatHz: 38, endBeatHz: 6, curve: 'logarithmic', startGain: 0.48, endGain: 0.34},
        engine,
        3,
      ),
    ],
    totalSec,
    fadeSec,
  );
  return normalizeProtocol({
    id: `ai-psychedelic-${Date.now()}`,
    title: 'Visionary Journey',
    description: INTENT_DEFS[0].summaryProtocol,
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: 0.32,
    fadeOutEndGain: 0.04,
  });
}

function buildChaoticProtocol(engine: EngineMode, totalSec: number): SessionProtocol {
  const fadeSec = 30;
  const zigzag: {start: number; end: number; label: string; curve: RampCurve}[] = [
    {start: 18, end: 35, label: 'Beta surge', curve: 'linear'},
    {start: 35, end: 12, label: 'Drop', curve: 'logarithmic'},
    {start: 12, end: 40, label: 'Gamma spike', curve: 'linear'},
    {start: 40, end: 22, label: 'Beta churn', curve: 'logarithmic'},
    {start: 22, end: 38, label: 'Gamma flicker', curve: 'linear'},
    {start: 38, end: 15, label: 'Settle', curve: 'logarithmic'},
  ];
  const stepSec = Math.max((totalSec - fadeSec) / zigzag.length, 45);
  const steps = zigzag.map((z, i) =>
    makeStep(
      {
        label: z.label,
        durationSec: stepSec,
        startBeatHz: z.start,
        endBeatHz: z.end,
        curve: z.curve,
        startGain: 0.44 + (i % 2) * 0.06,
        endGain: 0.4 + ((i + 1) % 2) * 0.08,
        engineMode: i % 2 === 0 ? engine : 'isochronic',
      },
      engine,
      i,
    ),
  );
  return normalizeProtocol({
    id: `ai-chaotic-${Date.now()}`,
    title: 'Chaotic Energy',
    description: INTENT_DEFS[1].summaryProtocol,
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: 0.36,
    fadeOutEndGain: 0.04,
  });
}

function buildDynamicProtocol(engine: EngineMode, totalSec: number): SessionProtocol {
  const fadeSec = 30;
  const phases = [
    {label: 'Alpha · arrive', start: 10, end: 12},
    {label: 'Beta · engage', start: 12, end: 20},
    {label: 'Gamma · peak', start: 20, end: 32},
    {label: 'Alpha · breathe', start: 32, end: 10},
    {label: 'Theta · depth', start: 10, end: 6},
  ];
  const stepSec = Math.max((totalSec - fadeSec) / phases.length, 60);
  const steps = phases.map((p, i) =>
    makeStep(
      {
        label: p.label,
        durationSec: stepSec,
        startBeatHz: p.start,
        endBeatHz: p.end,
        curve: p.end < p.start ? 'logarithmic' : 'linear',
        startGain: 0.4,
        endGain: 0.38,
      },
      engine,
      i,
    ),
  );
  return normalizeProtocol({
    id: `ai-dynamic-${Date.now()}`,
    title: 'Dynamic Sequence',
    description: INTENT_DEFS[2].summaryProtocol,
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: 0.35,
    fadeOutEndGain: 0.04,
  });
}

function buildHypnoticProtocol(engine: EngineMode, totalSec: number): SessionProtocol {
  const fadeSec = 30;
  const steps = scaleSteps(
    [
      makeStep(
        {label: 'Alpha · induction', durationSec: 480, startBeatHz: 10, endBeatHz: 7, curve: 'logarithmic', engineMode: engine},
        engine,
        0,
      ),
      makeStep(
        {label: 'Theta · trance', durationSec: 900, startBeatHz: 7, endBeatHz: 5, curve: 'logarithmic', engineMode: 'isochronic'},
        engine,
        1,
      ),
      makeStep(
        {label: 'Theta + flicker', durationSec: 600, startBeatHz: 5, endBeatHz: 5, curve: 'linear', engineMode: 'isochronic', startGain: 0.42, endGain: 0.42},
        engine,
        2,
      ),
    ],
    totalSec,
    fadeSec,
  );
  return normalizeProtocol({
    id: `ai-hypnotic-${Date.now()}`,
    title: 'Hypnotic Induction',
    description: INTENT_DEFS[7].summaryProtocol,
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: 0.32,
    fadeOutEndGain: 0.04,
  });
}

function buildEuphoricProtocol(engine: EngineMode, totalSec: number): SessionProtocol {
  const fadeSec = 30;
  const steps = scaleSteps(
    [
      makeStep({label: 'Alpha · open', durationSec: 420, startBeatHz: 10, endBeatHz: 14, curve: 'linear'}, engine, 0),
      makeStep({label: 'Beta · lift', durationSec: 600, startBeatHz: 14, endBeatHz: 22, curve: 'linear'}, engine, 1),
      makeStep({label: 'Gamma · peak', durationSec: 480, startBeatHz: 22, endBeatHz: 35, curve: 'linear'}, engine, 2),
      makeStep({label: 'Alpha · glow', durationSec: 600, startBeatHz: 35, endBeatHz: 11, curve: 'logarithmic'}, engine, 3),
    ],
    totalSec,
    fadeSec,
  );
  return normalizeProtocol({
    id: `ai-euphoric-${Date.now()}`,
    title: 'Euphoric Arc',
    description: INTENT_DEFS[3].summaryProtocol,
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: 0.38,
    fadeOutEndGain: 0.04,
  });
}

function buildMelancholicProtocol(engine: EngineMode, totalSec: number): SessionProtocol {
  const fadeSec = 30;
  const steps = scaleSteps(
    [
      makeStep({label: 'Alpha · soften', durationSec: 600, startBeatHz: 10, endBeatHz: 8, curve: 'logarithmic', startGain: 0.36, endGain: 0.32}, engine, 0),
      makeStep({label: 'Theta · depth', durationSec: 900, startBeatHz: 8, endBeatHz: 5, curve: 'logarithmic', startGain: 0.32, endGain: 0.28}, engine, 1),
      makeStep({label: 'Delta · still', durationSec: 600, startBeatHz: 5, endBeatHz: 2.5, curve: 'logarithmic', startGain: 0.28, endGain: 0.24}, engine, 2),
    ],
    totalSec,
    fadeSec,
  );
  return normalizeProtocol({
    id: `ai-melancholic-${Date.now()}`,
    title: 'Melancholic Descent',
    description: INTENT_DEFS[4].summaryProtocol,
    steps,
    stopAfterSec: 0,
    stopAfterPlayback: true,
    fadeOutDurationSec: fadeSec,
    fadeOutStartGain: 0.28,
    fadeOutEndGain: 0.04,
  });
}

export function buildExperientialProtocol(
  match: ExperientialMatch,
  prompt: string,
  engine: EngineMode,
  options: {history?: ChatTurn[]; premium?: boolean; experimental?: boolean} = {},
): SessionProtocol | null {
  const totalSec =
    inferTargetTotalSecFromConversation(options.history ?? [], prompt) ??
    (match.id === 'chaotic' ? 20 * 60 : match.id === 'dynamic' ? 30 * 60 : 35 * 60);

  switch (match.id) {
    case 'psychedelic':
      return buildPsychedelicProtocol(engine, totalSec);
    case 'chaotic':
      return buildChaoticProtocol(engine, totalSec);
    case 'dynamic':
      return buildDynamicProtocol(engine, totalSec);
    case 'hypnotic':
      return buildHypnoticProtocol(engine, totalSec);
    case 'euphoric':
      return buildEuphoricProtocol(engine, totalSec);
    case 'melancholic':
      return buildMelancholicProtocol(engine, totalSec);
    case 'serene':
    case 'grounding':
      return null;
    default:
      return null;
  }
}

/** True when sentiment language should route to protocol even without "sequence" keywords. */
export function experientialPrefersProtocol(text: string): boolean {
  const m = classifyExperientialIntent(text);
  return m != null && m.prefersProtocol;
}
