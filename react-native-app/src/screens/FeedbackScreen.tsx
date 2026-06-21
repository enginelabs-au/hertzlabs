import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AppMessageForm} from '../components/messaging/AppMessageForm';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import {SUPPORT_EMAIL} from '../constants/appInfo';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

type FeedbackActionProps = {
  title: string;
  description: string;
  subject: string;
  bodyPrefix: string;
  category: string;
};

function FeedbackAction({title, description, subject, bodyPrefix, category}: FeedbackActionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.actionCard}>
      <Pressable
        style={styles.actionHeader}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <View style={styles.actionHeaderText}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDesc}>{description}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded && (
        <AppMessageForm
          to="support"
          subject={subject}
          category={category}
          placeholder={`${bodyPrefix.trim()}\n\n`}
          prompt={`Send a message to ${SUPPORT_EMAIL}. Device details are attached automatically.`}
        />
      )}
    </View>
  );
}

export function FeedbackScreen() {
  const scrollInsets = useModalScrollInsets(32);
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

        <ScrollView
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Tell us what broke or what you want next. Expand a card, write your message, and tap
            Send — no email app required.
          </Text>

          <FeedbackAction
            title="Report a bug"
            description="Something crashed, glitched, or behaved unexpectedly."
            subject="Hertz Labs bug report"
            bodyPrefix="What happened:\n\nSteps to reproduce:\n\nExpected vs actual:"
            category="feedback_bug"
          />

          <FeedbackAction
            title="Request a feature"
            description="Suggest an engine, protocol, or workflow improvement."
            subject="Hertz Labs feature request"
            bodyPrefix="I would love Hertz Labs to:"
            category="feedback_feature"
          />

          <Text style={styles.note}>
            Messages go to {SUPPORT_EMAIL}. We aim to reply within two business days.
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
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  actionHeaderText: {
    flex: 1,
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
  chevron: {
    fontSize: 14,
    color: HertzTheme.text.muted,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: HertzTheme.text.muted,
    marginTop: 4,
  },
});
