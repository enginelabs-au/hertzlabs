import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {breathPhaseAt} from '../../breathPacer/breathEnvelope';
import type {BreathPatternId} from '../../breathPacer/patterns';
import {HertzTheme} from '../../theme/hertzTheme';

const TICK_MS = 50;
const RING_SIZE = 96;

type Props = {
  enabled: boolean;
  patternId: BreathPatternId;
  clockStartedAtMs: number | null;
};

export function BreathVisualizer({enabled, patternId, clockStartedAtMs}: Props) {
  const scaleSV = useSharedValue(0.5);
  const [label, setLabel] = useState('Breath overlay off');

  useEffect(() => {
    if (!enabled || clockStartedAtMs == null) {
      scaleSV.value = withTiming(0.5, {duration: 300});
      setLabel('Breath overlay off');
      return;
    }

    const tick = () => {
      const phase = breathPhaseAt(patternId, clockStartedAtMs);
      if (phase == null) {
        return;
      }
      scaleSV.value = withTiming(phase.visualScale, {
        duration: TICK_MS,
        easing: Easing.out(Easing.cubic),
      });
      setLabel(phase.label);
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, patternId, clockStartedAtMs, scaleSV]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{scale: scaleSV.value}],
    opacity: enabled ? 0.85 : 0.35,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{scale: 0.55 + scaleSV.value * 0.25}],
    opacity: enabled ? 0.5 : 0.2,
  }));

  return (
    <View style={styles.wrap} accessibilityLabel={`Breathing guide: ${label}`}>
      <View style={styles.ringDock}>
        <Animated.View style={[styles.ringOuter, ringStyle]} />
        <Animated.View style={[styles.ringInner, innerStyle]} />
        <View style={styles.centerDot} />
      </View>
      <Text style={[styles.phaseLabel, !enabled && styles.phaseLabelMuted]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ringDock: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  ringInner: {
    position: 'absolute',
    width: RING_SIZE * 0.72,
    height: RING_SIZE * 0.72,
    borderRadius: (RING_SIZE * 0.72) / 2,
    borderWidth: 1,
    borderColor: HertzTheme.neon.magenta,
    backgroundColor: 'rgba(255,92,225,0.05)',
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HertzTheme.neon.cyan,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
    letterSpacing: 0.4,
    fontFamily: HertzTheme.mono,
    textTransform: 'uppercase',
  },
  phaseLabelMuted: {
    color: HertzTheme.text.muted,
  },
});
