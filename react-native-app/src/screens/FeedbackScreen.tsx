import React, {useCallback} from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {APP_VERSION} from '../constants/appInfo';
import {SUPPORT_EMAIL} from '../constants/legalUrls';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

function buildMailto(subject: string, bodyPrefix: string): string {
  const meta = [
    '',
    '---',
    `App version: ${APP_VERSION}`,
    `Platform: ${Platform.OS} ${String(Platform.Version)}`,
  ].join('\n');
  const body = encodeURIComponent(`${bodyPrefix.trim()}\n${meta}`);
  const subj = encodeURIComponent(subject);
  return `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${body}`;
}

type FeedbackActionProps = {
  title: string;
  description: string;
  subject: string;
  bodyPrefix: string;
};

function FeedbackAction({title, description, subject, bodyPrefix}: FeedbackActionProps) {
  const open = useCallback(() => {
    void Linking.openURL(buildMailto(subject, bodyPrefix));
  }, [subject, bodyPrefix]);

  return (
    <Pressable style={styles.actionCard} onPress={open} accessibilityRole="button">
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDesc}>{description}</Text>
      <Text style={styles.actionEmail}>{SUPPORT_EMAIL}</Text>
    </Pressable>
  );
}

export function FeedbackScreen() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Feedback</Text>
          <Pressable
            onPress={() => setActiveModal(null)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close feedback">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Tell us what broke or what you want next. Your device details are pre-filled so we can
            reproduce issues faster.
          </Text>

          <FeedbackAction
            title="Report a bug"
            description="Something crashed, glitched, or behaved unexpectedly."
            subject="Hertz Labs bug report"
            bodyPrefix="What happened:\n\nSteps to reproduce:\n\nExpected vs actual:"
          />

          <FeedbackAction
            title="Request a feature"
            description="Suggest an engine, protocol, or workflow improvement."
            subject="Hertz Labs feature request"
            bodyPrefix="I would love Hertz Labs to:"
          />

          <Text style={styles.note}>
            Opens your mail app with {SUPPORT_EMAIL}. We aim to reply within two business days.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: HertzTheme.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: HertzTheme.glassBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: HertzTheme.glassBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    fontSize: 14,
    color: HertzTheme.text.secondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: HertzTheme.text.secondary,
    marginBottom: 4,
  },
  actionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
    padding: 14,
    gap: 4,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
  },
  actionDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: HertzTheme.text.secondary,
  },
  actionEmail: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 2,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: HertzTheme.text.muted,
    marginTop: 4,
  },
});
