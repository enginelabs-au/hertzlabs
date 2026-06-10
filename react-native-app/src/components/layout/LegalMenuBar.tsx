import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Slim footer strip — tap opens the in-app Legal screen. */
export function LegalMenuBar() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  return (
    <Pressable
      style={styles.bar}
      onPress={() => setActiveModal('legal')}
      accessibilityRole="button"
      accessibilityLabel="Legal information">
      <Text style={styles.label}>Legal</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(12,14,22,0.96)',
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
