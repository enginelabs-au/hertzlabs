import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Plans + Legal — pinned at the bottom of each screen. */
export function LegalMenuBar() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const tier = useHertzStore(s => s.tier);
  const premium = isPremiumUnlocked(tier);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          style={styles.menuBtn}
          onPress={() => setActiveModal('paywall')}
          accessibilityRole="button"
          accessibilityLabel="View subscription plans">
          <Text style={[styles.menuLabel, premium && styles.menuLabelActive]}>Plans</Text>
        </Pressable>
        <Text style={styles.separator}>·</Text>
        <Pressable
          style={styles.menuBtn}
          onPress={() => setActiveModal('legal')}
          accessibilityRole="button"
          accessibilityLabel="Legal information">
          <Text style={styles.menuLabel}>Legal</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: 'rgba(12,14,22,0.96)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  menuLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  menuLabelActive: {
    color: HertzTheme.neon.amber,
  },
  separator: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
  },
});
