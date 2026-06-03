import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {HertzTheme} from '../../theme/hertzTheme';

export function GestureLegend() {
  return (
    <View style={styles.row}>
      <Text style={styles.item}>↻ Spin = Freq</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={styles.item}>↕ Drag = Phase</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={styles.item}>↔ Drag = Delta</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  item: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    letterSpacing: 0.3,
  },
  sep: {
    fontSize: 10,
    color: HertzTheme.text.muted,
    opacity: 0.5,
  },
});
