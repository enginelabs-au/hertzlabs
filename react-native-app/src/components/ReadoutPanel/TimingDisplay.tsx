import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';

interface TimingDisplayProps {
  timingDiffMs: SharedValue<number>;
}

/**
 * Monospace channel timing difference readout.
 * Uses useState + useAnimatedReaction + runOnJS to avoid the AnimatedTextInput
 * blank-value bug in Reanimated 4 + Fabric. Formats with a leading '+' for
 * non-negative values; all string work happens on the JS thread.
 */
export function TimingDisplay({timingDiffMs}: TimingDisplayProps) {
  const [timingText, setTimingText] = useState(() => {
    const ms = timingDiffMs.value;
    return (ms >= 0 ? '+' : '') + ms.toFixed(1) + ' ms';
  });

  const onTiming = useCallback((v: number) => {
    setTimingText((v >= 0 ? '+' : '') + v.toFixed(1) + ' ms');
  }, []);

  useAnimatedReaction(
    () => timingDiffMs.value,
    val => {
      runOnJS(onTiming)(val);
    },
    [onTiming],
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label}>TIMING </Text>
      <Text style={styles.value}>{timingText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    width: 72,
  },
  value: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'right',
    minWidth: 110,
  },
});
