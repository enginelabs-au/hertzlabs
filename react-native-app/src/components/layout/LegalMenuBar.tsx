import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Tap to open legal documents — pinned at the bottom of each screen. */
export function LegalMenuBar() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.legalBtn}
        onPress={() => setActiveModal('legal')}
        accessibilityRole="button"
        accessibilityLabel="Legal information">
        <Text style={styles.legalLabel}>Legal</Text>
      </Pressable>
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
  legalBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  legalLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
