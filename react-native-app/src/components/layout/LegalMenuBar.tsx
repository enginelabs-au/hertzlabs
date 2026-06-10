import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {APP_BUNDLE_ID, formatAppDevFooter} from '../../constants/appMetadata';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Slim footer strip — dev metadata plus tap to open Legal. */
export function LegalMenuBar() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  return (
    <View style={styles.container}>
      <Text style={styles.devLine} accessibilityLabel="App build information">
        {formatAppDevFooter()}
      </Text>
      <Text style={styles.bundleLine}>{APP_BUNDLE_ID}</Text>
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
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(12,14,22,0.96)',
    gap: 2,
  },
  devLine: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '600',
    color: HertzTheme.text.secondary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  bundleLine: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.text.muted,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  legalBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
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
