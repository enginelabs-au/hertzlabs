import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {useHertzStore} from '../../state/store';

interface TimingDisplayProps {
  timingDiffMs: SharedValue<number>;
}

export function TimingDisplay(_props: TimingDisplayProps) {
  const leftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));

  const l = leftHz === 0 ? '0' : `${leftHz > 0 ? '+' : ''}${leftHz.toFixed(1)}`;
  const r = rightHz === 0 ? '0' : `${rightHz > 0 ? '+' : ''}${rightHz.toFixed(1)}`;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>DRIFT</Text>
      <Text style={styles.value}>{`L ${l} · R ${r} Hz`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
  },
  value: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
  },
});
