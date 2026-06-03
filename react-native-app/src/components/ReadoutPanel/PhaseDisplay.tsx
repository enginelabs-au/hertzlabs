import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {runOnJS, useAnimatedReaction} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {useHertzStore} from '../../state/store';

interface PhaseDisplayProps {
  phaseAngle: SharedValue<number>;
}

/**
 * Monospace phase angle readout.
 * Uses useState + useAnimatedReaction + runOnJS to avoid the AnimatedTextInput
 * blank-value bug in Reanimated 4 + Fabric. String formatting happens on the
 * JS thread where toFixed is always safe.
 */
export function PhaseDisplay({phaseAngle}: PhaseDisplayProps) {
  const phaseFromStore = useHertzStore(s => s.phaseAngle);
  const [phaseText, setPhaseText] = useState(() => phaseFromStore.toFixed(1) + '°');

  const onPhase = useCallback((v: number) => {
    setPhaseText(v.toFixed(1) + '°');
  }, []);

  useAnimatedReaction(
    () => phaseAngle.value,
    val => {
      runOnJS(onPhase)(val);
    },
    [onPhase],
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label}>PHASE  </Text>
      <Text style={styles.value}>{phaseText}</Text>
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
    minWidth: 90,
  },
});
