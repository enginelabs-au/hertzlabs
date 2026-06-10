import React, {useState, useCallback} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {useHertzStore} from '../state/store';
import {BRAINWAVE_BANDS} from '../components/ReadoutPanel/brainwaveBands';
import type {EngineMode} from '../state/types';

const BG = '#000000';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#4ADE80';
const MUTED = 'rgba(255,255,255,0.38)';
const WARN = '#FBBF24';
const MONO = 'JetBrainsMono-Regular';

export interface SessionRecommendation {
  brainwaveState: string;
  targetFrequencyHz: number;
  targetedBrainRegions: string[];
  entrainmentStyle: 'Binaural' | 'Isochronic' | 'Monaural';
  intensityScale: number;
  explanationShort: string;
}

type ParseStatus = 'idle' | 'loading' | 'done' | 'offline' | 'error';

const EXAMPLE_INTENTS = [
  'I need to focus for a coding session for the next 2 hours',
  'Help me relax and prepare for sleep',
  'I want deep meditation with a calm, grounded feeling',
  'Boost my creativity for an art project',
];

/**
 * On-device intent guide. Classifies a free-text goal across many wellness
 * categories and returns an appropriate entrainment recommendation. This is a
 * local heuristic (not a live LLM call): the Gemini key is stored natively and
 * never exposed to the JS bundle, so suggestions are generated on-device.
 */
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
    keywords: ['focus', 'concentrate', 'concentration', 'study', 'studying', 'work', 'working', 'productiv', 'coding', 'code', 'exam', 'attention', 'task', 'deadline', 'read', 'reading', 'homework'],
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

const STRONGER_CUES = ['deep', 'deeper', 'intense', 'strong', 'strongly', 'very', 'maximum', 'powerful', 'hard'];
const GENTLER_CUES = ['light', 'gentle', 'subtle', 'mild', 'slight', 'soft', 'little', 'easy'];
const SPEAKER_CUES = ['speaker', 'speakers', 'out loud', 'without headphones', 'no headphones'];
const PULSE_CUES = ['isochronic', 'pulse', 'pulsing', 'rhythmic', 'beat'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function countHits(haystack: string, needles: string[]): number {
  return needles.reduce((n, k) => (haystack.includes(k) ? n + 1 : n), 0);
}

/** Local intent guide. Async with a short delay so the UI shows progress. */
async function generateGuidance(prompt: string): Promise<SessionRecommendation> {
  await new Promise<void>(resolve => setTimeout(() => resolve(), 900));

  const lower = ` ${prompt.toLowerCase().trim()} `;

  let best: IntentProfile = DEFAULT_PROFILE;
  let bestScore = 0;
  for (const profile of INTENT_PROFILES) {
    const score = countHits(lower, profile.keywords);
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }

  const rec: SessionRecommendation = {...best.rec, targetedBrainRegions: [...best.rec.targetedBrainRegions]};

  // Intensity modifiers from descriptive cues.
  if (countHits(lower, STRONGER_CUES) > 0) {
    rec.intensityScale = clamp(rec.intensityScale + 0.15, 0.15, 0.95);
  }
  if (countHits(lower, GENTLER_CUES) > 0) {
    rec.intensityScale = clamp(rec.intensityScale - 0.15, 0.15, 0.95);
  }

  // Delivery style cues override the profile default.
  if (countHits(lower, SPEAKER_CUES) > 0) {
    rec.entrainmentStyle = 'Monaural';
  } else if (countHits(lower, PULSE_CUES) > 0) {
    rec.entrainmentStyle = 'Isochronic';
  }

  rec.targetFrequencyHz = clamp(rec.targetFrequencyHz, 0.5, 50);
  rec.intensityScale = clamp(rec.intensityScale, 0, 1);
  return rec;
}

function getBandColor(hz: number): string {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band.hexColor;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1].hexColor;
}

function entrainmentStyleToMode(style: SessionRecommendation['entrainmentStyle']): EngineMode {
  switch (style) {
    case 'Binaural': return 'binaural';
    case 'Isochronic': return 'isochronic';
    case 'Monaural': return 'monaural';
  }
}

interface RecommendationCardProps {
  rec: SessionRecommendation;
  onApply: () => void;
}

function RecommendationCard({rec, onApply}: RecommendationCardProps) {
  const bandColor = getBandColor(rec.targetFrequencyHz);

  return (
    <View style={styles.recCard}>
      <View style={styles.recHeader}>
        <View style={[styles.recBandBadge, {borderColor: bandColor + '60', backgroundColor: bandColor + '18'}]}>
          <Text style={[styles.recBandText, {color: bandColor}]}>{rec.brainwaveState}</Text>
        </View>
        <Text style={[styles.recHz, {color: bandColor}]}>
          {rec.targetFrequencyHz.toFixed(2)} Hz
        </Text>
      </View>

      <Text style={styles.recExplanation}>{rec.explanationShort}</Text>

      <View style={styles.recMeta}>
        <View style={styles.recMetaRow}>
          <Text style={styles.recMetaLabel}>Entrainment</Text>
          <Text style={styles.recMetaValue}>{rec.entrainmentStyle}</Text>
        </View>
        <View style={styles.recMetaRow}>
          <Text style={styles.recMetaLabel}>Intensity</Text>
          <View style={styles.intensityBar}>
            <View style={[styles.intensityFill, {width: `${rec.intensityScale * 100}%` as `${number}%`}]} />
          </View>
          <Text style={styles.recMetaValue}>{(rec.intensityScale * 100).toFixed(0)}%</Text>
        </View>
        <View style={styles.recMetaRow}>
          <Text style={styles.recMetaLabel}>Regions</Text>
          <Text style={styles.recMetaValue}>{rec.targetedBrainRegions.join(', ')}</Text>
        </View>
      </View>

      <Pressable style={styles.applyBtn} onPress={onApply} accessibilityRole="button">
        <Text style={styles.applyBtnText}>Apply This Session →</Text>
      </Pressable>
    </View>
  );
}

function OfflineFallback({onSelectPreset}: {onSelectPreset: (hz: number) => void}) {
  const FALLBACK_PRESETS = [
    {label: 'Schumann 7.83 Hz', hz: 7.83},
    {label: 'Alpha Focus 10 Hz', hz: 10.0},
    {label: 'Beta Focus 18 Hz', hz: 18.0},
    {label: 'Theta Meditation 6 Hz', hz: 6.0},
  ];

  return (
    <View style={styles.offlineCard}>
      <Text style={styles.offlineIcon}>📡</Text>
      <Text style={styles.offlineTitle}>Offline — Manual Presets</Text>
      <Text style={styles.offlineDesc}>
        AI parsing requires an internet connection. Select a preset manually:
      </Text>
      {FALLBACK_PRESETS.map(p => (
        <Pressable
          key={p.hz}
          style={styles.fallbackPreset}
          onPress={() => onSelectPreset(p.hz)}>
          <Text style={[styles.fallbackHz, {color: getBandColor(p.hz)}]}>
            {p.hz.toFixed(2)} Hz
          </Text>
          <Text style={styles.fallbackLabel}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function AIParserScreen() {
  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [recommendation, setRecommendation] = useState<SessionRecommendation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setParam = useHertzStore(s => s.setParam);
  const setEngineType = useHertzStore(s => s.setEngineType);

  const handleParse = useCallback(async () => {
    if (!intent.trim()) {
      return;
    }
    setStatus('loading');
    setRecommendation(null);
    setErrorMsg(null);

    try {
      const rec = await generateGuidance(intent);
      setRecommendation(rec);
      setStatus('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'OFFLINE') {
        setStatus('offline');
      } else {
        setStatus('error');
        setErrorMsg(msg);
      }
    }
  }, [intent]);

  const handleApply = useCallback(() => {
    if (recommendation == null) {
      return;
    }
    setParam('beatHz', recommendation.targetFrequencyHz);
    setEngineType(entrainmentStyleToMode(recommendation.entrainmentStyle));
    setParam('gain', recommendation.intensityScale * 0.5);
  }, [recommendation, setParam, setEngineType]);

  const handleFallbackSelect = useCallback((hz: number) => {
    setParam('beatHz', hz);
    setStatus('idle');
  }, [setParam]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Guide</Text>
          <Text style={styles.headerSubtitle}>
            Describe how you want to feel and the AI Guide will suggest entrainment settings to match.
          </Text>
        </View>

        {/* Input area */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>What would you like to achieve?</Text>
          <TextInput
            style={styles.input}
            value={intent}
            onChangeText={setIntent}
            placeholder="e.g. I need to focus for a coding session…"
            placeholderTextColor={MUTED}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Example intents */}
          <View style={styles.examplesRow}>
            {EXAMPLE_INTENTS.map((ex, i) => (
              <Pressable
                key={i}
                style={styles.exampleChip}
                onPress={() => setIntent(ex)}>
                <Text style={styles.exampleChipText} numberOfLines={1}>
                  {ex}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.parseBtn, (!intent.trim() || status === 'loading') && styles.parseBtnDisabled]}
            onPress={handleParse}
            disabled={!intent.trim() || status === 'loading'}
            accessibilityRole="button">
            {status === 'loading' ? (
              <View style={styles.parseBtnLoading}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.parseBtnText}>Thinking…</Text>
              </View>
            ) : (
              <Text style={styles.parseBtnText}>Ask AI Guide →</Text>
            )}
          </Pressable>
        </View>

        {/* Results */}
        {status === 'done' && recommendation != null && (
          <RecommendationCard rec={recommendation} onApply={handleApply} />
        )}

        {status === 'offline' && (
          <OfflineFallback onSelectPreset={handleFallbackSelect} />
        )}

        {status === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠ {errorMsg ?? 'Unknown error'}</Text>
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Heads up:</Text> this is an AI guide, not a
            medical device. Its suggestions are generated automatically and may be
            inaccurate, incomplete, or unsuitable for you. Binaural beats are not a
            treatment for any condition and nothing here is medical advice — please
            consult a qualified professional for any health concern.
          </Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
      <LegalMenuBar />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  inputCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    lineHeight: 20,
  },
  examplesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exampleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: '48%',
  },
  exampleChipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  parseBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  parseBtnDisabled: {
    opacity: 0.4,
  },
  parseBtnLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  recCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recBandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  recBandText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recHz: {
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: '700',
  },
  recExplanation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  recMeta: {
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
  },
  recMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    width: 72,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recMetaValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    flex: 1,
    flexWrap: 'wrap',
  },
  intensityBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  intensityFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  applyBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  offlineCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  offlineIcon: {
    fontSize: 28,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: WARN,
  },
  offlineDesc: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 19,
  },
  fallbackPreset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
  },
  fallbackHz: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '700',
    width: 72,
  },
  fallbackLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    padding: 12,
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: '700',
    color: WARN,
  },
  bottomPad: {
    height: 20,
  },
});
