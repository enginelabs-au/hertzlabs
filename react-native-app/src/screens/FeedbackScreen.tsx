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
import {SUPPORT_EMAIL, HELLO_EMAIL} from '../constants/appInfo';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const AFFILIATE_TERMS_URL = 'https://enginelabs-au.github.io/hertzlabs/affiliate/';

type FeedbackActionProps = {
  title: string;
  description: string;
  subject: string;
  bodyPrefix: string;
  category: string;
  to?: 'support' | 'hello';
  requireFromEmail?: boolean;
  fromEmailPlaceholder?: string;
  sentMessage?: string;
  formFooterNote?: string;
};

function FeedbackAction({
  title,
  description,
  subject,
  bodyPrefix,
  category,
  to = 'support',
  requireFromEmail = false,
  fromEmailPlaceholder,
  sentMessage,
  formFooterNote,
}: FeedbackActionProps) {
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
        <View style={styles.formWrap}>
          <AppMessageForm
            to={to}
            subject={subject}
            category={category}
            placeholder={`${bodyPrefix.trim()}\n\n`}
            prompt={`Send a message to ${to === 'hello' ? HELLO_EMAIL : SUPPORT_EMAIL}. Device details are attached automatically.`}
            requireFromEmail={requireFromEmail}
            fromEmailPlaceholder={
              fromEmailPlaceholder ??
              (requireFromEmail ? 'Your email (required)' : 'Your email (optional, for a reply)')
            }
            sentMessage={sentMessage}
            formFooterNote={formFooterNote}
          />
        </View>
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

          <FeedbackAction
            title="Become an affiliate"
            description="Apply to partner with Hertz Labs — promote with authentic content and explore revenue share for qualified creators. Earnings subject to application and partnership terms."
            subject="Hertz Labs — affiliate application"
            bodyPrefix={
              'My channels (links):\n\nAudience / niche:\n\nHow I would promote Hertz Labs:\n\nI use Hertz Labs: (yes/no)\n\nMy HZ referrer code (if any):'
            }
            category="feedback_affiliate_apply"
            to="hello"
            requireFromEmail
            fromEmailPlaceholder="Your email (required — we reply here about your application)"
            sentMessage={`Application sent to ${HELLO_EMAIL}. We review affiliate applications manually. Submitting does not guarantee acceptance or any specific earnings.`}
            formFooterNote={`Partnership terms: ${AFFILIATE_TERMS_URL}`}
          />

          <FeedbackAction
            title="Connect with us"
            description="Developers, media, legal, partnerships, or general inquiries — say hello."
            subject="Hertz Labs — connect"
            bodyPrefix="I'd like to connect about:"
            category="feedback_connect"
            to="hello"
          />

          <Text style={styles.note}>
            Messages go to {SUPPORT_EMAIL} (bug reports and features) or {HELLO_EMAIL} (affiliate
            and connect). We aim to reply within two business days.
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
  formWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: HertzTheme.text.muted,
    marginTop: 4,
  },
});
