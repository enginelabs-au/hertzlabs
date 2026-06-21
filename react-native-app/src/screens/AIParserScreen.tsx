import React, {useCallback} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ScreenScrollLayout} from '../components/layout/ScreenScrollLayout';
import {AIGuideChatSection} from '../components/ai/AIGuideChatSection';
import {AIFormulaSection} from '../components/math/AIFormulaSection';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {HertzTheme} from '../theme/hertzTheme';

const WARN = '#FBBF24';
const FOLD_STYLE = {marginHorizontal: 0};

export function AIParserScreen() {
  const tier = useHertzStore(s => s.tier);
  const isAdvancedMode = useHertzStore(s => s.isAdvancedMode);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const unlocked = isPremiumUnlocked(tier);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenScrollLayout contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>
            {isAdvancedMode
              ? 'Two conversational modes — session guidance and math formulas — both apply settings to your live audio. Ask either mode for a custom timed sequence; it loads in Protocol Sequences within each mode.'
              : 'Tell the guide what you want to feel — it configures your session automatically. Timed sequences live in Protocol Sequences within this guide.'}
          </Text>
        </View>

        <AIGuideChatSection
          layoutMode={isAdvancedMode ? 'advanced' : 'simple'}
          foldStyle={FOLD_STYLE}
        />

        {isAdvancedMode && (
          <AIFormulaSection
            unlocked={unlocked}
            onUpgrade={openPaywall}
            foldStyle={FOLD_STYLE}
          />
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Heads up:</Text> this is an AI guide, not a
            medical device. Its suggestions are generated automatically and may be
            inaccurate, incomplete, or unsuitable for you. Binaural beats are not a
            treatment for any condition and nothing here is medical advice — please
            consult a qualified professional for any health concern.
          </Text>
        </View>
      </ScreenScrollLayout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 10,
  },
  header: {
    gap: 6,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: HertzTheme.text.muted,
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    padding: 12,
    marginTop: 6,
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
});
