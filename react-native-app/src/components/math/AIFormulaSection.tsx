import React, {useCallback, useRef, useState} from 'react';
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
import {getStereoFrequencies} from '../../audio/paramMapping';
import {isExperimentalModeActive, isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from './MathFoldSection';
import {BreathPacerSection} from '../breathPacer/BreathPacerSection';
import {ProtocolSequencesSection} from '../protocol/ProtocolSequencesSection';
import {ModeSessionEnhancements} from '../session/ModeSessionEnhancements';
import {AI_FORMULA_CHIPS, generateFormulaFromPrompt} from './aiFormulaGenerator';
import {applyFormulaEvalToSession} from './applyFormulaEvalToSession';
import type {FormulaAppliedPayload} from './activeFormulaDisplay';
import {useChatAutoScroll} from '../ai/useChatAutoScroll';
import type {ChatTurn} from '../../ai/aiPromptParsing';
import {generateProtocolFromPrompt} from '../../ai/protocolGeneration';
import type {AiApplyPayload, AiChatMessage} from '../../state/slices/aiChat';
import {
  evaluateAiRateLimit,
  formatCooldownMessage,
  formatNearLimitHint,
} from '../../ai/aiRateLimit';

type AIFormulaSectionProps = {
  unlocked: boolean;
  onUpgrade: () => void;
  onFormulaApplied?: (payload: FormulaAppliedPayload) => void;
  foldStyle?: ViewStyle;
  defaultExpanded?: boolean;
};

export function AIFormulaSection({
  unlocked,
  onUpgrade,
  onFormulaApplied,
  foldStyle,
  defaultExpanded = false,
}: AIFormulaSectionProps) {
  const messages = useHertzStore(s => s.formulaMessages);
  const appendMessages = useHertzStore(s => s.appendFormulaMessages);
  const resetChat = useHertzStore(s => s.resetFormulaChat);
  const startProtocol = useHertzStore(s => s.startProtocol);
  const setProtocolDraftSeed = useHertzStore(s => s.setProtocolDraftSeed);
  const noteAiCall = useHertzStore(s => s.noteAiCall);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const {chatScrollRef, onChatContentSizeChange} = useChatAutoScroll(messages.length, loading);
  const inputRef = useRef<TextInput>(null);

  const applyPayload = useCallback(
    (payload: AiApplyPayload) => {
      if (payload.type === 'formula') {
        applyFormulaEvalToSession(payload.hz);
      } else if (payload.type === 'protocol') {
        setProtocolDraftSeed(payload.protocol);
        startProtocol(payload.protocol);
      }
    },
    [setProtocolDraftSeed, startProtocol],
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
      appendMessages([{id: `u-${Date.now()}`, role: 'user', text: trimmed}]);
      setPrompt('');

      // Rolling-window guard: cut off before the provider rate limit, then cool down.
      const rate = evaluateAiRateLimit(useHertzStore.getState().aiCallLog, Date.now());
      if (!rate.allowed) {
        appendMessages([
          {id: `a-${Date.now()}`, role: 'assistant', text: formatCooldownMessage(rate.retryAfterMs)},
        ]);
        return;
      }
      noteAiCall();
      const nearLimitHint = rate.nearLimit ? formatNearLimitHint(rate.remaining) : '';
      setLoading(true);

      try {
        const s = useHertzStore.getState();

        // Timed sequence request → build + start a protocol.
        const protocolResult = await generateProtocolFromPrompt(trimmed, {
          history,
          beatHz: s.beatHz,
          gain: s.gain,
          engineType: s.engineType,
        });
        if (protocolResult != null) {
          setProtocolDraftSeed(protocolResult.protocol);
          startProtocol(protocolResult.protocol);
          appendMessages([
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: protocolResult.summary + nearLimitHint,
              apply: {type: 'protocol', protocol: protocolResult.protocol},
            },
          ]);
          return;
        }

        const experimental = isExperimentalModeActive(s.tier, s.experimentalMode);
        const {leftHz, rightHz} = getStereoFrequencies(s.carrierHz, s.beatHz, s.tier, experimental);
        const liveCtx = {f_L: leftHz, f_R: rightHz, f_beat: s.beatHz, f_c: s.carrierHz};
        const result = await generateFormulaFromPrompt(trimmed, liveCtx, {
          history,
          engineType: s.engineType,
          experimental,
          premium: isPremiumUnlocked(s.tier),
        });

        let assistantText = result.reply;
        let apply: AiApplyPayload | undefined;
        if (result.error != null) {
          assistantText += `\n\n⚠ Could not evaluate: ${result.error}`;
        } else if (result.evalHz != null) {
          applyFormulaEvalToSession(result.evalHz);
          onFormulaApplied?.({
            formula: result.formula,
            explanation: result.reply,
            hz: result.evalHz,
            source: 'ai',
          });
          assistantText += `\n\n→ Applied ${result.formula} = ${result.evalHz.toFixed(2)} Hz (${result.bandLabel ?? 'band'}) to live audio.`;
          apply = {type: 'formula', hz: result.evalHz};
        }

        appendMessages([
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: assistantText + nearLimitHint,
            formula: result.formula?.trim() ? result.formula : undefined,
            apply,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [appendMessages, loading, messages, noteAiCall, onFormulaApplied, setProtocolDraftSeed, startProtocol],
  );

  return (
    <MathFoldSection
      icon="✦"
      title="AI Formula"
      tag="Math"
      blurb="Describe a state or phenomenon — AI derives a formula or timed sequence and applies it live."
      deepDive="Ask about brain states, resonance patterns, or multi-step journeys (e.g. “45 min sleep sequence”). Tap any past reply to re-apply. Sequences load in Protocol Sequences here."
      isLocked={!unlocked}
      onUpgrade={onUpgrade}
      isActive={messages.length > 0}
      defaultExpanded={defaultExpanded}
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
          <Text style={styles.emptyChat}>Ask about brainwave math — tap a clip or type below.</Text>
        )}
        {messages.map(msg => {
          const canApply = msg.role === 'assistant' && msg.apply != null;
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
              {msg.formula != null && <Text style={styles.formulaLine}>{msg.formula}</Text>}
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
            <ActivityIndicator color={HertzTheme.neon.cyan} size="small" />
            <Text style={styles.loadingText}>Generating…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.chipsRow}>
        {AI_FORMULA_CHIPS.map(chip => (
          <Pressable
            key={chip.label}
            style={styles.chip}
            onPress={() => submitPrompt(chip.prompt)}
            disabled={loading}>
            <Text style={styles.chipText}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        ref={inputRef}
        style={styles.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Ask for a formula or follow up to adjust…"
        placeholderTextColor={HertzTheme.text.muted}
        multiline
        scrollEnabled={false}
        editable={!loading}
      />
      <Pressable
        style={[styles.sendBtn, (!prompt.trim() || loading) && styles.sendBtnDisabled]}
        onPress={() => submitPrompt(prompt)}
        disabled={!prompt.trim() || loading}>
        <Text style={styles.sendBtnText}>Send →</Text>
      </Pressable>
      <View style={styles.automationFolds}>
        <ModeSessionEnhancements foldStyle={styles.protocolFold} embedded />
        <BreathPacerSection foldStyle={styles.protocolFold} embedded />
        <ProtocolSequencesSection foldStyle={styles.protocolFold} embedded />
      </View>
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
    backgroundColor: 'rgba(92,225,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.2)',
    alignSelf: 'flex-start',
    maxWidth: '96%',
  },
  bubbleApplied: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.16)',
  },
  bubbleText: {
    fontSize: 12,
    color: HertzTheme.text.primary,
    lineHeight: 18,
  },
  formulaLine: {
    fontFamily: HertzTheme.mono,
    fontSize: 13,
    color: HertzTheme.neon.cyan,
    marginTop: 8,
    fontWeight: '700',
  },
  applyHint: {
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
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
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: 'rgba(255,80,180,0.15)',
    borderColor: HertzTheme.neon.magenta,
  },
  speechListening: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.neon.magenta,
    textAlign: 'center',
    marginBottom: 6,
  },
  speechError: {
    fontSize: 10,
    color: HertzTheme.neon.amber,
    textAlign: 'center',
    marginBottom: 6,
  },
  sendBtn: {
    backgroundColor: 'rgba(92,225,255,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sendBtnFlex: {
    flex: 1,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
  },
  automationFolds: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  protocolFold: {
    marginHorizontal: 0,
  },
});
