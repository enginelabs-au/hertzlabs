import React, {useCallback, useRef, useState, type RefObject} from 'react';
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
import {isExperimentalModeActive, isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import type {EngineMode} from '../../state/types';
import {HertzTheme} from '../../theme/hertzTheme';
import {MathFoldSection} from '../math/MathFoldSection';
import {SimpleSessionAutomationMenu} from '../simple/SimpleSessionAutomationMenu';
import {
  formatRecommendationMessage,
  generateGuidance,
  type SessionRecommendation,
} from './aiGuideGenerator';
import {applyFormulaEvalToSession, pushNativeAudioNow} from '../math/applyFormulaEvalToSession';
import type {ChatTurn} from '../../ai/aiPromptParsing';
import {generateProtocolFromPrompt, isSequenceRequestInConversation} from '../../ai/protocolGeneration';
import {experientialPrefersProtocol} from '../../ai/experientialIntent';
import {
  getGeminiOutageReason,
  resetGeminiOutage,
  resetGeminiOutageForRetry,
  shouldShowOutageNotice,
  geminiUnavailableExplanation,
  messageExplainsGeminiOutage,
  type GeminiOutageReason,
} from '../../ai/geminiChatClient';
import type {AiApplyPayload, AiChatMessage, GuideAdvancedSettings} from '../../state/slices/aiChat';
import {
  evaluateAiRateLimit,
  formatCooldownMessage,
  formatNearLimitHint,
} from '../../ai/aiRateLimit';
import {HOME_QUICK_CLIPS} from '../home/homeQuickClips';
import {useChatAutoScroll} from './useChatAutoScroll';

type QuickStartIntent = {
  label: string;
  prompt: string;
};

/**
 * Honest, user-appropriate banner when the Gemini service itself failed this
 * turn — so a built-in fallback is never silently presented as the AI's answer.
 */
function formatOutageNotice(reason: GeminiOutageReason): string {
  return `⚠️ ${geminiUnavailableExplanation(reason)}\n\n`;
}

const ADVANCED_QUICK_START: QuickStartIntent[] = [
  {label: 'ADHD Focus', prompt: 'Help me clear my mind and stay hyper-focused for a tough task'},
  {label: 'Deep Sleep', prompt: 'Help me relax deeply and drift into restorative sleep tonight'},
  {label: 'Sleep Sequence', prompt: 'Create a sleep sequence that gradually ramps down over 45 minutes'},
  {label: 'Focus Sequence', prompt: 'Build a 50 minute focus sequence ramping into beta then sustaining'},
  {label: 'Neuro Reset', prompt: 'Create a cyclical neuro reset sequence alternating epsilon and lambda'},
  {label: 'Creative Flow', prompt: 'I want to unlock creative flow and open awareness for my art project'},
  {label: 'Anxiety Relief', prompt: 'Help me calm racing thoughts and ease anxiety right now'},
];

const SIMPLE_QUICK_START: QuickStartIntent[] = [
  {
    label: 'ADHD Focus',
    prompt:
      'Configure a sharp beta-band focus session with smooth volume and a 45-minute automation loop for ADHD concentration',
  },
  {
    label: 'Deep Sleep',
    prompt:
      'Build a deep sleep journey starting in alpha, gliding to delta, with a long fade-out and sleep countdown automation',
  },
  {
    label: 'Creative Flow',
    prompt:
      'Set up a theta-to-alpha creative flow session with gentle transitions and an automated sequence for open awareness',
  },
  {
    label: 'Anxiety Relief',
    prompt:
      'Calm anxiety with alpha-theta entrainment, soft volume, and an automated session that eases down over 30 minutes',
  },
  {
    label: 'Lucid Dreaming',
    prompt:
      'Create a lucid dreaming protocol in theta with timed transitions, fade timing, and session automation for dream states',
  },
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

/** Prefer an explicit engineMode from the AI; fall back to the entrainment style. */
function resolveEngineMode(rec: SessionRecommendation): EngineMode {
  return rec.engineMode ?? entrainmentStyleToMode(rec.entrainmentStyle);
}

export type AIGuideLayoutMode = 'advanced' | 'simple' | 'home' | 'homeInline';

type AIGuideChatSectionProps = {
  foldStyle?: ViewStyle;
  layoutMode?: AIGuideLayoutMode;
  inputRef?: RefObject<TextInput | null>;
  /** Receives the submit function so the parent can trigger sends from outside (e.g. a TextInput outside a ScrollView). */
  submitRef?: RefObject<((text: string) => void) | null>;
  /** Receives the loading flag so the parent can disable an external input while a request is in flight. */
  loadingRef?: RefObject<boolean>;
};

export function AIGuideChatSection({
  foldStyle,
  layoutMode = 'advanced',
  inputRef,
  submitRef,
  loadingRef,
}: AIGuideChatSectionProps) {
  const setParam = useHertzStore(s => s.setParam);
  const setEngineType = useHertzStore(s => s.setEngineType);
  const toggleNoiseLayer = useHertzStore(s => s.toggleNoiseLayer);
  const setNoiseMix = useHertzStore(s => s.setNoiseMix);
  const startProtocol = useHertzStore(s => s.startProtocol);
  const setProtocolDraftSeed = useHertzStore(s => s.setProtocolDraftSeed);
  const noteAiCall = useHertzStore(s => s.noteAiCall);
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
  const premium = isPremiumUnlocked(tier);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [appliedClip, setAppliedClip] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {chatScrollRef, onChatContentSizeChange} = useChatAutoScroll(messages.length, loading);


  const applyHomeClip = useCallback(
    (clip: (typeof HOME_QUICK_CLIPS)[number]) => {
      setParam('beatHz', clip.beatHz);
      setEngineType(clip.engineMode);
      setParam('gain', clip.gain);
      pushNativeAudioNow();
      setAppliedClip(clip.label);
      setTimeout(() => setAppliedClip(null), 1600);
    },
    [setEngineType, setParam],
  );

  const quickStarts = layoutMode === 'advanced' ? ADVANCED_QUICK_START : SIMPLE_QUICK_START;
  const isHome = layoutMode === 'home' || layoutMode === 'homeInline';
  const isSimple = layoutMode === 'simple';
  const isHomeInline = layoutMode === 'homeInline';

  const applyGuideSettings = useCallback(
    (adv?: GuideAdvancedSettings) => {
      if (adv == null) {
        return;
      }
      if (adv.carrierHz != null) {
        setParam('carrierHz', adv.carrierHz);
      }
      if (adv.phaseAngle != null) {
        setParam('phaseAngle', adv.phaseAngle);
      }
      if (adv.leftDriftHz != null) {
        setParam('leftDriftHz', adv.leftDriftHz);
      }
      if (adv.rightDriftHz != null) {
        setParam('rightDriftHz', adv.rightDriftHz);
      }
      if (adv.balance != null) {
        setParam('balance', adv.balance);
      }
      if (adv.noiseLayer != null) {
        // toggleNoiseLayer turns the chosen layer on (others off); only act when state differs.
        const layers = useHertzStore.getState().noiseLayers;
        if (adv.noiseLayer === 'none') {
          (['white', 'pink', 'brown'] as const).forEach(l => {
            if (layers[l]) {
              toggleNoiseLayer(l);
            }
          });
        } else if (!layers[adv.noiseLayer]) {
          toggleNoiseLayer(adv.noiseLayer);
        }
      }
      if (adv.noiseMix != null) {
        setNoiseMix(adv.noiseMix);
      }
    },
    [setNoiseMix, setParam, toggleNoiseLayer],
  );

  const applyPayload = useCallback(
    (payload: AiApplyPayload) => {
      if (payload.type === 'guide') {
        setParam('beatHz', payload.beatHz);
        setEngineType(payload.engineMode);
        setParam('gain', payload.gain);
        applyGuideSettings(payload.advanced);
        pushNativeAudioNow();
      } else if (payload.type === 'protocol') {
        setProtocolDraftSeed(payload.protocol);
        startProtocol(payload.protocol);
      } else if (payload.type === 'formula') {
        applyFormulaEvalToSession(payload.hz);
      }
    },
    [applyGuideSettings, setEngineType, setParam, setProtocolDraftSeed, startProtocol],
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

      // Rolling-window guard: cut off before the provider rate limit, then cool down.
      const rate = evaluateAiRateLimit(useHertzStore.getState().aiCallLog, Date.now());
      if (!rate.allowed) {
        const cooldown = formatCooldownMessage(rate.retryAfterMs);
        setNotice(cooldown);
        setTimeout(() => setNotice(null), 5000);
        if (!isHomeInline) {
          appendMessages([{id: `a-${Date.now()}`, role: 'assistant', text: cooldown}]);
        }
        return;
      }
      noteAiCall();
      const nearLimitHint = rate.nearLimit ? formatNearLimitHint(rate.remaining) : '';
      setLoading(true);
      // Fresh turn: clear any prior AI-service outage flag so the notice below
      // only reflects this submission.
      resetGeminiOutage();

      try {
        const wantsProtocol =
          isSequenceRequestInConversation(history, trimmed) || experientialPrefersProtocol(trimmed);

        // Guide first (lighter prompt, ~12s max). Sequence build only if guide succeeds.
        const rec = await generateGuidance(trimmed, {
          history,
          currentBeatHz: beatHz,
          currentGain: gain,
          carrierHz,
          engineType,
          experimental,
          premium,
        });
        const guideOk = !messageExplainsGeminiOutage(rec.explanationShort);

        if (guideOk && wantsProtocol) {
          resetGeminiOutage();
          const protocolResult = await generateProtocolFromPrompt(trimmed, {
            history,
            beatHz,
            gain,
            engineType,
            premium,
            experimental,
          });
          if (protocolResult != null) {
            const outage = getGeminiOutageReason();
            const outageNotice =
              outage != null && messageExplainsGeminiOutage(protocolResult.summary)
                ? ''
                : shouldShowOutageNotice(outage)
                  ? formatOutageNotice(outage!)
                  : '';
            setProtocolDraftSeed(protocolResult.protocol);
            startProtocol(protocolResult.protocol);
            appendMessages([
              {
                id: `a-${Date.now()}`,
                role: 'assistant',
                text: outageNotice + protocolResult.summary + nearLimitHint,
                apply: {type: 'protocol', protocol: protocolResult.protocol},
              },
            ]);
            return;
          }
          resetGeminiOutageForRetry();
        }

        const engineMode = resolveEngineMode(rec);
        const recGain = rec.intensityScale * 0.5;
        setParam('beatHz', rec.targetFrequencyHz);
        setEngineType(engineMode);
        setParam('gain', recGain);
        applyGuideSettings(rec.advanced);
        pushNativeAudioNow();

        const sequenceFallbackNote =
          guideOk && wantsProtocol
            ? 'Could not build a timed sequence from the free model this turn — applied a single live target instead.\n\n'
            : '';

        const guideOutage = getGeminiOutageReason();
        const guideOutageNotice =
          guideOutage != null && messageExplainsGeminiOutage(rec.explanationShort)
            ? ''
            : shouldShowOutageNotice(guideOutage)
              ? formatOutageNotice(guideOutage!)
              : '';
        appendMessages([
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: guideOutageNotice + sequenceFallbackNote + formatRecommendationMessage(rec) + nearLimitHint,
            apply: {
              type: 'guide',
              beatHz: rec.targetFrequencyHz,
              engineMode,
              gain: recGain,
              advanced: rec.advanced,
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessages,
      applyGuideSettings,
      beatHz,
      carrierHz,
      engineType,
      experimental,
      gain,
      loading,
      messages,
      noteAiCall,
      premium,
      setEngineType,
      setParam,
      setProtocolDraftSeed,
      startProtocol,
      isHomeInline,
    ],
  );

  // Expose imperative handles to parent for the external input strip.
  if (submitRef != null) {
    submitRef.current = submitPrompt;
  }
  if (loadingRef != null) {
    loadingRef.current = loading;
  }

  if (isHomeInline) {
    return (
      <View style={[styles.homeInline, foldStyle]}>
        {loading && <Text style={styles.homeInlineLoading}>Configuring…</Text>}
        {notice != null && <Text style={styles.speechError}>{notice}</Text>}
        {appliedClip != null && (
          <Text style={styles.homeApplied}>Applied: {appliedClip}</Text>
        )}
        <View style={styles.homeChipsRow}>
          {HOME_QUICK_CLIPS.map(item => (
            <Pressable
              key={item.label}
              style={[styles.homeChip, appliedClip === item.label && styles.homeChipActive]}
              onPress={() => applyHomeClip(item)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={`Quick start: ${item.label}`}>
              <Text style={styles.homeChipText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {(messages.length > 0 || loading) && (
          <ScrollView
            ref={chatScrollRef}
            style={styles.homeInlineHistory}
            nestedScrollEnabled
            onContentSizeChange={onChatContentSizeChange}
            showsVerticalScrollIndicator={false}>
            {messages.slice(-8).map(msg => {
              const canApply = msg.role === 'assistant' && msg.apply != null;
              const Wrapper: any = canApply ? Pressable : View;
              return (
                <Wrapper
                  key={msg.id}
                  onPress={canApply ? () => reapplyMessage(msg) : undefined}
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                    styles.bubbleHome,
                    appliedId === msg.id && styles.bubbleApplied,
                  ]}>
                  <Text style={[styles.bubbleText, styles.bubbleTextHome]}>{msg.text}</Text>
                  {canApply && (
                    <Text style={styles.applyHint}>
                      {appliedId === msg.id ? '✓ Applied' : '↺ Tap to re-apply'}
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
        )}

      </View>
    );
  }

  if (isHome) {
    return (
      <View style={[styles.homeOnly, foldStyle]}>
        {loading && (
          <View style={styles.homeLoadingRow}>
            <ActivityIndicator color={HertzTheme.neon.cyan} size="small" />
            <Text style={styles.homeLoadingText}>Configuring session…</Text>
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={styles.inputHomeOnly}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Type your goal…"
          placeholderTextColor={HertzTheme.text.muted}
          editable={!loading}
          returnKeyType="send"
          onSubmitEditing={() => submitPrompt(prompt)}
        />
        <Pressable
          style={[styles.sendBtnHomeOnly, (!prompt.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => submitPrompt(prompt)}
          disabled={!prompt.trim() || loading}>
          <Text style={styles.sendBtnText}>Go</Text>
        </Pressable>
      </View>
    );
  }

  const body = (
    <>
      {!isHome && (
        <View style={styles.toolbar}>
          <Text style={styles.toolbarLabel}>Conversation</Text>
          {messages.length > 0 && (
            <Pressable onPress={resetChat} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.resetBtn}>Reset</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        ref={chatScrollRef}
        style={[styles.chatScroll, isHome && styles.chatScrollHome]}
        nestedScrollEnabled
        onContentSizeChange={onChatContentSizeChange}>
        {messages.length === 0 && !isHome && (
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
                isHome && styles.bubbleHome,
              ]}>
              <Text style={[styles.bubbleText, isHome && styles.bubbleTextHome]} numberOfLines={isHome ? 4 : undefined}>
                {msg.text}
              </Text>
              {canApply && !isHome && (
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

      {!isHome && (
        <View style={styles.chipsRow}>
          {quickStarts.map(item => (
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
      )}

      <TextInput
        ref={inputRef}
        style={[styles.input, isHome && styles.inputHome]}
        value={prompt}
        onChangeText={setPrompt}
        placeholder={
          isHome
            ? 'Type your goal…'
            : 'e.g. I need focus for coding, but keep it gentle…'
        }
        placeholderTextColor={HertzTheme.text.muted}
        multiline={!isHome}
        scrollEnabled={false}
        editable={!loading}
      />
      <Pressable
        style={[styles.sendBtn, isHome && styles.sendBtnHome, (!prompt.trim() || loading) && styles.sendBtnDisabled]}
        onPress={() => submitPrompt(prompt)}
        disabled={!prompt.trim() || loading}>
        <Text style={styles.sendBtnText}>{isHome ? 'Go' : 'Send →'}</Text>
      </Pressable>

      {isSimple && <SimpleSessionAutomationMenu style={{marginHorizontal: 0}} />}
    </>
  );

  if (layoutMode === 'advanced') {
    return (
      <MathFoldSection
        icon="◎"
        title="AI Guide"
        tag="Session"
        blurb="Describe how you want to feel — the guide suggests entrainment or builds a timed sequence."
        deepDive="Chat to refine band, Hz, intensity, or multi-step journeys. Tap any past reply to re-apply. Sequences load in Protocol Sequences below."
        isActive={messages.length > 0}
        style={foldStyle}>
        {body}
      </MathFoldSection>
    );
  }

  return <View style={[styles.flatWrap, foldStyle]}>{body}</View>;
}

const styles = StyleSheet.create({
  flatWrap: {
    gap: 4,
  },
  homeOnly: {
    width: '100%',
    gap: 8,
  },
  homeLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  homeLoadingText: {
    fontSize: 11,
    color: HertzTheme.neon.cyan,
  },
  inputHomeOnly: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    color: HertzTheme.text.primary,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  sendBtnHomeOnly: {
    backgroundColor: 'rgba(92,225,255,0.16)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    paddingVertical: 10,
    alignItems: 'center',
  },
  homeInline: {
    width: '100%',
  },
  homeInlineHistory: {
    maxHeight: 220,
    marginBottom: 10,
  },
  homeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  homeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(92,225,255,0.08)',
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
  },
  homeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: HertzTheme.neon.cyan,
  },
  homeChipActive: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.22)',
  },
  homeApplied: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.neon.green,
    textAlign: 'center',
    marginBottom: 8,
  },
  homeInlineLoading: {
    fontSize: 10,
    color: HertzTheme.neon.cyan,
    textAlign: 'center',
    marginBottom: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineMic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(92,225,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inlineMicActive: {
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
  inlineInputExpanded: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    color: HertzTheme.text.primary,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  inlineGo: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(92,225,255,0.18)',
    borderWidth: 1,
    borderColor: HertzTheme.neon.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineGoText: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '800',
    color: HertzTheme.neon.cyan,
  },
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
  chatScrollHome: {
    maxHeight: 72,
    marginBottom: 6,
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
  bubbleHome: {
    padding: 6,
    marginBottom: 4,
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
  bubbleTextHome: {
    fontSize: 10,
    lineHeight: 14,
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
  inputHome: {
    minHeight: 36,
    fontSize: 13,
    paddingVertical: 8,
  },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micBtnBody: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.neon.green,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sendBtnFlex: {
    flex: 1,
  },
  sendBtnHome: {
    paddingVertical: 8,
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
