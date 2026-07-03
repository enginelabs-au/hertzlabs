import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';

type Props = {
  streakDays: number;
  peakStreakDays: number;
  onAccept: () => void;
  onDecline: () => void;
  onUseShield: () => void;
  shieldsRemaining: number;
};

export function StreakRestoreModal({
  streakDays,
  peakStreakDays,
  onAccept,
  onDecline,
  onUseShield,
  shieldsRemaining,
}: Props) {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const insets = useModalScrollInsets();
  const displayStreak = Math.max(streakDays, peakStreakDays);

  const dismissDecline = useCallback(() => {
    onDecline();
    setActiveModal(null);
  }, [onDecline, setActiveModal]);

  const accept = useCallback(() => {
    onAccept();
    setActiveModal(null);
  }, [onAccept, setActiveModal]);

  const shield = useCallback(() => {
    onUseShield();
    setActiveModal(null);
  }, [onUseShield, setActiveModal]);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} accessibilityLabel="Dismiss restore offer" />
      <View style={[styles.sheet, {paddingBottom: insets.paddingBottom}]}>
        <Text style={styles.title}>Restore your {displayStreak}-day streak?</Text>
        <Text style={styles.body}>
          You missed yesterday. Play at least 2 minutes today to keep your streak alive — or use a
          shield if you have one.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={accept}>
          <Text style={styles.primaryBtnText}>Restore streak</Text>
        </Pressable>
        {shieldsRemaining > 0 ? (
          <Pressable style={styles.secondaryBtn} onPress={shield}>
            <Text style={styles.secondaryBtnText}>Use streak shield ({shieldsRemaining})</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.linkBtn} onPress={dismissDecline}>
          <Text style={styles.linkBtnText}>Start fresh</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)'},
  sheet: {
    backgroundColor: HertzTheme.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {fontSize: 18, fontWeight: '700', color: HertzTheme.text.primary},
  body: {fontSize: 13, lineHeight: 19, color: HertzTheme.text.secondary},
  primaryBtn: {
    backgroundColor: HertzTheme.neon.cyan,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {fontWeight: '700', color: '#000'},
  secondaryBtn: {
    borderWidth: 1,
    borderColor: HertzTheme.neon.amber,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {color: HertzTheme.neon.amber, fontWeight: '600'},
  linkBtn: {paddingVertical: 8, alignItems: 'center'},
  linkBtnText: {color: HertzTheme.text.muted, fontSize: 13},
});
