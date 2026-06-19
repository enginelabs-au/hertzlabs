import React, {useCallback} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import type {PremiumGiftReminderKind} from '../monetization/premiumGiftReminders';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const BORDER = 'rgba(255,255,255,0.08)';

const COPY: Record<
  PremiumGiftReminderKind,
  {eyebrow: string; title: string; body: string; cta: string}
> = {
  dayBefore: {
    eyebrow: 'PREMIUM GIFT ENDING SOON',
    title: 'Your free Premium ends tomorrow',
    body:
      'Your complimentary Premium week wraps up in about one day. Subscribe now to keep full engine access, the extended frequency range, and background audio without interruption.',
    cta: 'Subscribe to Keep Premium',
  },
  expiryDay: {
    eyebrow: 'PREMIUM GIFT ENDING TODAY',
    title: 'Your free Premium ends today',
    body:
      'Your complimentary Premium access ends today. Subscribe to avoid losing full engine modes, the 0–500 Hz range, and background playback.',
    cta: 'Subscribe Now',
  },
};

export function PremiumGiftExpiryModal() {
  const scrollInsets = useModalScrollInsets(32);
  const kind = useHertzStore(s => s.activePremiumGiftReminder);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const setActivePremiumGiftReminder = useHertzStore(s => s.setActivePremiumGiftReminder);
  const markDayBefore = useHertzStore(s => s.markWelcomePremiumDayBeforeReminderShown);
  const markExpiryDay = useHertzStore(s => s.markWelcomePremiumExpiryDayReminderShown);

  const dismiss = useCallback(() => {
    if (kind === 'dayBefore') {
      markDayBefore();
    } else if (kind === 'expiryDay') {
      markExpiryDay();
    }
    setActivePremiumGiftReminder(null);
    setActiveModal(null);
  }, [kind, markDayBefore, markExpiryDay, setActiveModal, setActivePremiumGiftReminder]);

  const openPaywall = useCallback(() => {
    if (kind === 'dayBefore') {
      markDayBefore();
    } else if (kind === 'expiryDay') {
      markExpiryDay();
    }
    setActivePremiumGiftReminder(null);
    setActiveModal('paywall');
  }, [kind, markDayBefore, markExpiryDay, setActiveModal, setActivePremiumGiftReminder]);

  if (kind == null) {
    return null;
  }

  const content = COPY[kind];

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>{content.eyebrow}</Text>
            <Text style={styles.title}>{content.title}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}>
          <View style={styles.heroCard}>
            <Text style={styles.heroText}>{content.body}</Text>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={openPaywall}
            accessibilityRole="button"
            accessibilityLabel={content.cta}>
            <Text style={styles.primaryBtnText}>{content.cta}</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.laterBtnText}>Remind me later</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
    zIndex: 112,
  },
  sheet: {
    backgroundColor: '#0D0E18',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '72%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    marginBottom: 20,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  laterBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'underline',
  },
});
