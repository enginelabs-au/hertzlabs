import React from 'react';
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {isPremiumUnlocked} from '../../monetization/isPremiumUnlocked';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {LayoutModeToggle} from './LayoutModeToggle';

type LegalMenuBarProps = {
  /** Hide layout toggle on pre-app gates (e.g. safety onboarding). */
  showLayoutToggle?: boolean;
};

/** Plans + Legal + layout mode — scrolls with page content at the foot of each screen. */
export function LegalMenuBar({showLayoutToggle = true}: LegalMenuBarProps) {
  const insets = useSafeAreaInsets();
  const {fontScale} = useWindowDimensions();
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const tier = useHertzStore(s => s.tier);
  const premium = isPremiumUnlocked(tier);
  const bottomPad = Math.max(insets.bottom, 4);
  const compact = fontScale > 1.1;

  return (
    <View style={[styles.container, {paddingBottom: bottomPad}]}>
      {showLayoutToggle && <LayoutModeToggle />}
      <View style={[styles.row, compact && styles.rowCompact]}>
        <Pressable
          style={[styles.menuBtn, compact && styles.menuBtnCompact]}
          onPress={() => setActiveModal('paywall')}
          accessibilityRole="button"
          accessibilityLabel="View subscription plans">
          <Text
            style={[styles.menuLabel, premium && styles.menuLabelActive, compact && styles.menuLabelCompact]}
            maxFontSizeMultiplier={1.2}>
            Plans
          </Text>
        </Pressable>
        <Text style={[styles.separator, compact && styles.separatorCompact]} maxFontSizeMultiplier={1.0}>
          ·
        </Text>
        <Pressable
          style={[styles.menuBtn, compact && styles.menuBtnCompact]}
          onPress={() => setActiveModal('promos')}
          accessibilityRole="button"
          accessibilityLabel="Earn promo codes">
          <Text style={[styles.menuLabel, compact && styles.menuLabelCompact]} maxFontSizeMultiplier={1.2}>
            Promos
          </Text>
        </Pressable>
        <Text style={[styles.separator, compact && styles.separatorCompact]} maxFontSizeMultiplier={1.0}>
          ·
        </Text>
        <Pressable
          style={[styles.menuBtn, compact && styles.menuBtnCompact]}
          onPress={() => setActiveModal('feedback')}
          accessibilityRole="button"
          accessibilityLabel="Send feedback or report a bug">
          <Text style={[styles.menuLabel, compact && styles.menuLabelCompact]} maxFontSizeMultiplier={1.2}>
            Feedback
          </Text>
        </Pressable>
        <Text style={[styles.separator, compact && styles.separatorCompact]} maxFontSizeMultiplier={1.0}>
          ·
        </Text>
        <Pressable
          style={[styles.menuBtn, compact && styles.menuBtnCompact]}
          onPress={() => setActiveModal('legal')}
          accessibilityRole="button"
          accessibilityLabel="Legal information">
          <Text style={[styles.menuLabel, compact && styles.menuLabelCompact]} maxFontSizeMultiplier={1.2}>
            Legal
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  rowCompact: {
    gap: 0,
    paddingHorizontal: 4,
  },
  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  menuBtnCompact: {
    paddingVertical: 4,
    paddingHorizontal: 6,
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
  menuLabelCompact: {
    letterSpacing: 0.3,
    fontSize: 9,
  },
  separator: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
  },
  separatorCompact: {
    marginHorizontal: 0,
    fontSize: 9,
  },
});
