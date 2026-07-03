import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  nextStreakTier,
  shieldsEarnedForStreak,
  streakTierForDays,
} from '../../promos/streakGamification';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

export function StreakWidget() {
  const streakDays = useHertzStore(s => s.streakDays);
  const streakShieldsUsed = useHertzStore(s => s.streakShieldsUsed);
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  if (streakDays <= 0) {
    return null;
  }

  const tier = streakTierForDays(streakDays);
  const next = nextStreakTier(streakDays);
  const shields = Math.max(0, shieldsEarnedForStreak(streakDays) - streakShieldsUsed);

  return (
    <Pressable style={styles.wrap} onPress={() => setActiveModal('promos')} accessibilityRole="button">
      <Text style={styles.emoji}>{tier.emoji}</Text>
      <View style={styles.body}>
        <Text style={styles.title}>
          {tier.label} · {streakDays} day{streakDays === 1 ? '' : 's'}
        </Text>
        <Text style={styles.sub}>
          {next != null ? `${next.minDays - streakDays} days to ${next.label}` : 'Top tier'}
          {shields > 0 ? ` · ${shields} shield${shields === 1 ? '' : 's'}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  emoji: {fontSize: 22},
  body: {flex: 1, gap: 2},
  title: {fontSize: 13, fontWeight: '700', color: HertzTheme.text.primary},
  sub: {fontSize: 11, color: HertzTheme.text.muted},
  chevron: {fontSize: 18, color: HertzTheme.text.muted},
});
