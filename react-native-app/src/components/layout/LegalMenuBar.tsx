import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {LayoutModeToggle} from './LayoutModeToggle';

type LegalMenuBarProps = {
  /** Hide layout toggle on pre-app gates (e.g. safety onboarding). */
  showLayoutToggle?: boolean;
};

/** Plans + Legal + layout mode — pinned at the bottom of each screen. */
export function LegalMenuBar({showLayoutToggle = true}: LegalMenuBarProps) {
  const insets = useSafeAreaInsets();
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const tier = useHertzStore(s => s.tier);
  const premium = isPremiumUnlocked(tier);
  const bottomPad = Math.max(insets.bottom, 4);

  return (
    <View style={[styles.container, {paddingBottom: bottomPad}]}>
      {showLayoutToggle && <LayoutModeToggle />}
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
          onPress={() => setActiveModal('feedback')}
          accessibilityRole="button"
          accessibilityLabel="Send feedback or report a bug">
          <Text style={styles.menuLabel}>Feedback</Text>
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
