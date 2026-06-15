import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Text-only toggle for Advanced ↔ Simple layout — free for all tiers. */
export function LayoutModeToggle() {
  const isAdvancedMode = useHertzStore(s => s.isAdvancedMode);
  const toggleAdvancedMode = useHertzStore(s => s.toggleAdvancedMode);

  return (
    <Pressable
      style={styles.btn}
      onPress={toggleAdvancedMode}
      accessibilityRole="button"
      accessibilityLabel={
        isAdvancedMode
          ? 'Advanced mode is on. Tap to switch to simple mode.'
          : 'Advanced mode is off. Tap to switch to advanced mode.'
      }>
      <Text style={styles.label}>
        {isAdvancedMode ? 'Advanced Mode (On)' : 'Advanced Mode (Off)'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 0.6,
  },
});
