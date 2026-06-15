import React, {useCallback} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {LegalMenuBar} from '../components/layout/LegalMenuBar';
import {AIGuideChatSection} from '../components/ai/AIGuideChatSection';
import {AIFormulaSection} from '../components/math/AIFormulaSection';
import {ProtocolSequencesSection} from '../components/protocol/ProtocolSequencesSection';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';
import {HertzTheme} from '../theme/hertzTheme';

const WARN = '#FBBF24';
const FOLD_STYLE = {marginHorizontal: 0};

export function AIParserScreen() {
  const tier = useHertzStore(s => s.tier);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const unlocked = isPremiumUnlocked(tier);

  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>
            Two conversational modes — session guidance and math formulas — both apply settings to your live audio. Ask either mode for a custom timed sequence; it loads in Protocol Sequences below.
          </Text>
        </View>

        <AIGuideChatSection foldStyle={FOLD_STYLE} />

        <AIFormulaSection
          unlocked={unlocked}
          onUpgrade={openPaywall}
          foldStyle={FOLD_STYLE}
        />

        <ProtocolSequencesSection foldStyle={FOLD_STYLE} />

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
    backgroundColor: HertzTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
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
  bottomPad: {
    height: 20,
  },
});
