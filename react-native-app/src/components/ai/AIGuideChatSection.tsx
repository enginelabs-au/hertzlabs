import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {useHertzStore} from '../../state/store';
import {isExperimentalModeActive} from '../../monetization/isPremiumUnlocked';
import type {EngineMode} from '../../state/types';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from '../math/MathFoldSection';
import {
  formatRecommendationMessage,
  generateGuidance,
  type SessionRecommendation,
} from './aiGuideGenerator';
import {applyFormulaEvalToSession, pushNativeAudioNow} from '../math/applyFormulaEvalToSession';
import type {ChatTurn} from '../../ai/aiPromptParsing';
import {generateProtocolFromPrompt} from '../../ai/protocolGeneration';
import type {AiApplyPayload, AiChatMessage} from '../../state/slices/aiChat';
import {useChatAutoScroll} from './useChatAutoScroll';

type QuickStartIntent = {
  label: string;
  prompt: string;
};

const QUICK_START_INTENTS: QuickStartIntent[] = [
  {label: 'ADHD Focus', prompt: 'Help me clear my mind and stay hyper-focused for a tough task'},
  {label: 'Deep Sleep', prompt: 'Help me relax deeply and drift into restorative sleep tonight'},
  {label: 'Sleep Sequence', prompt: 'Create a sleep sequence that gradually ramps down over 45 minutes'},
  {label: 'Focus Sequence', prompt: 'Build a 50 minute focus sequence ramping into beta then sustaining'},
  {label: 'Neuro Reset', prompt: 'Create a cyclical neuro reset sequence alternating epsilon and lambda'},
  {label: 'Creative Flow', prompt: 'I want to unlock creative flow and open awareness for my art project'},
  {label: 'Anxiety Relief', prompt: 'Help me calm racing thoughts and ease anxiety right now'},
];

function entrainmentStyleToMode(style: SessionRecommendation['entrainmentStyle']): EngineMode {
  switch (style) {
    case 'Binaural':
      return 'binaural';
    case 'Isochronic':
      return 'isochronic';
    case 'Monaural':
      return 'monaural';
  }
}

type AIGuideChatSectionProps = {
  foldStyle?: ViewStyle;
};

export function AIGuideChatSection({foldStyle}: AIGuideChatSectionProps) {
  const setParam = useHertzStore(s => s.setParam);
  const setEngineType = useHertzStore(s => s.setEngineType);
  const startProtocol = useHertzStore(s => s.startProtocol);
  const setProtocolDraftSeed = useHertzStore(s => s.setProtocolDraftSeed);
  const messages = useHertzStore(s => s.guideMessages);
  const appendMessages = useHertzStore(s => s.appendGuideMessages);
  const resetChat = useHertzStore(s => s.resetGuideChat);
  const beatHz = useHertzStore(s => s.beatHz);
  const carrierHz = useHertzStore(s => s.carrierHz);
  const gain = useHertzStore(s => s.gain);
  const engineType = useHertzStore(s => s.engineType);
  const tier = useHertzStore(s => s.tier);
  const experimentalMode = useHertzStore(s => s.experimentalMode);
  const experimental = isExperimentalModeActive(tier, experimentalMode);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const {chatScrollRef, onChatContentSizeChange} = useChatAutoScroll(messages.length, loading);

  const applyPayload = useCallback(
    (payload: AiApplyPayload) => {
      if (payload.type === 'guide') {
        setParam('beatHz', payload.beatHz);
        setEngineType(payload.engineMode);
        setParam('gain', payload.gain);
        pushNativeAudioNow();
      } else if (payload.type === 'protocol') {
        setProtocolDraftSeed(payload.protocol);
        startProtocol(payload.protocol);
      } else if (payload.type === 'formula') {
        applyFormulaEvalToSession(payload.hz);
      }
    },
    [setEngineType, setParam, setProtocolDraftSeed, startProtocol],
  );

  const reapplyMessage = useCallback(
    (msg: AiChatMessage) => {
      if (msg.apply == null) {
        return;
      }
      applyPayload(msg.apply);
      setAppliedId(msg.id);
      setTimeout(() => setAppliedId(null), 1400);
    },
    [applyPayload],
  );

  const submitPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) {
        return;
      }
      const history: ChatTurn[] = messages.map(m => ({role: m.role, text: m.text}));
      const userMsg: AiChatMessage = {id: `u-${Date.now()}`, role: 'user', text: trimmed};
      appendMessages([userMsg]);
      setPrompt('');
      setLoading(true);

      try {
        const protocolResult = await generateProtocolFromPrompt(trimmed, {
          history,
          beatHz,
          gain,
          engineType,
        });
        if (protocolResult != null) {
          setProtocolDraftSeed(protocolResult.protocol);
          startProtocol(protocolResult.protocol);
          appendMessages([
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: protocolResult.summary,
              apply: {type: 'protocol', protocol: protocolResult.protocol},
            },
          ]);
          return;
        }

        const rec = await generateGuidance(trimmed, {
          history,
          currentBeatHz: beatHz,
          currentGain: gain,
          carrierHz,
          engineType,
          experimental,
        });
        const engineMode = entrainmentStyleToMode(rec.entrainmentStyle);
        const recGain = rec.intensityScale * 0.5;
        setParam('beatHz', rec.targetFrequencyHz);
        setEngineType(engineMode);
        setParam('gain', recGain);
        pushNativeAudioNow();

        appendMessages([
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: formatRecommendationMessage(rec),
            apply: {type: 'guide', beatHz: rec.targetFrequencyHz, engineMode, gain: recGain},
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [appendMessages, beatHz, carrierHz, engineType, experimental, gain, loading, messages, setEngineType, setParam, setProtocolDraftSeed, startProtocol],
  );

  return (
    <MathFoldSection
      icon="◎"
      title="AI Guide"
      tag="Session"
      blurb="Describe how you want to feel — the guide suggests entrainment or builds a timed sequence."
      deepDive="Chat to refine band, Hz, intensity, or multi-step journeys. Tap any past reply to re-apply. Sequences load in Protocol Sequences below."
      isActive={messages.length > 0}
      style={foldStyle}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarLabel}>Conversation</Text>
        {messages.length > 0 && (
          <Pressable onPress={resetChat} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.resetBtn}>Reset</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={chatScrollRef}
        style={styles.chatScroll}
        nestedScrollEnabled
        onContentSizeChange={onChatContentSizeChange}>
        {messages.length === 0 && (
          <Text style={styles.emptyChat}>
            Tell the guide your goal — tap a quick start or type below.
          </Text>
        )}
        {messages.map(msg => {
          const isAssistant = msg.role === 'assistant';
          const canApply = isAssistant && msg.apply != null;
          const Wrapper: any = canApply ? Pressable : View;
          return (
            <Wrapper
              key={msg.id}
              onPress={canApply ? () => reapplyMessage(msg) : undefined}
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                appliedId === msg.id && styles.bubbleApplied,
              ]}>
              <Text style={styles.bubbleText}>{msg.text}</Text>
              {canApply && (
                <Text style={styles.applyHint}>
                  {appliedId === msg.id ? '✓ Applied' : '↺ Tap to apply'}
                </Text>
              )}
            </Wrapper>
          );
        })}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={HertzTheme.neon.green} size="small" />
            <Text style={styles.loadingText}>Thinking…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.chipsRow}>
        {QUICK_START_INTENTS.map(item => (
          <Pressable
            key={item.label}
            style={styles.chip}
            onPress={() => submitPrompt(item.prompt)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={`Quick start: ${item.label}`}>
            <Text style={styles.chipText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="e.g. I need focus for coding, but keep it gentle…"
        placeholderTextColor={HertzTheme.text.muted}
        multiline
        editable={!loading}
      />
      <Pressable
        style={[styles.sendBtn, (!prompt.trim() || loading) && styles.sendBtnDisabled]}
        onPress={() => submitPrompt(prompt)}
        disabled={!prompt.trim() || loading}>
        <Text style={styles.sendBtnText}>Send →</Text>
      </Pressable>
    </MathFoldSection>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toolbarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resetBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: HertzTheme.neon.amber,
  },
  chatScroll: {
    maxHeight: 260,
    marginBottom: 10,
  },
  emptyChat: {
    fontSize: 12,
    color: HertzTheme.text.muted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  bubble: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  aiBubble: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
    alignSelf: 'flex-start',
    maxWidth: '96%',
  },
  bubbleApplied: {
    borderColor: HertzTheme.neon.green,
    backgroundColor: 'rgba(74,222,128,0.16)',
  },
  bubbleText: {
    fontSize: 12,
    color: HertzTheme.text.primary,
    lineHeight: 18,
  },
  applyHint: {
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.neon.green,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: HertzTheme.text.muted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    color: HertzTheme.text.primary,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  sendBtn: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.neon.green,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: HertzTheme.neon.green,
  },
});
