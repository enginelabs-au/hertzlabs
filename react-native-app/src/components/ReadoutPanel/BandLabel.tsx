import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {runOnJS, useAnimatedReaction, useAnimatedStyle} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {BRAINWAVE_BANDS} from './brainwaveBands';

const BAND_LABEL_STRINGS: string[] = BRAINWAVE_BANDS.map(b => b.label);
const BAND_HZ_RANGES: string[] = BRAINWAVE_BANDS.map(b => b.rangeLabel);
const BAND_COLORS: string[] = BRAINWAVE_BANDS.map(b => b.hexColor);

interface BandLabelProps {
  bandIndex: SharedValue<number>;
  bandOpacity: SharedValue<number>;
}

/**
 * Animated monospace band name + Hz range row.
 * Cross-fade driven by `bandOpacity` (withSequence 0→1 on band boundary crossing).
 *
 * Uses useState + useAnimatedReaction + runOnJS pattern to avoid the
 * AnimatedTextInput blank-value bug in Reanimated 4 + Fabric for non-zero
 * initial shared values.
 */
/** Default Alpha band — synced on first frame via useAnimatedReaction. */
const DEFAULT_BAND_IDX = 3;

export function BandLabel({bandIndex, bandOpacity}: BandLabelProps) {
  const [labelText, setLabelText] = useState(BAND_LABEL_STRINGS[DEFAULT_BAND_IDX] ?? '');
  const [rangeText, setRangeText] = useState(BAND_HZ_RANGES[DEFAULT_BAND_IDX] ?? '');
  const [colorText, setColorText] = useState(BAND_COLORS[DEFAULT_BAND_IDX] ?? '#FFFFFF');

  const onBandChange = useCallback((index: number) => {
    setLabelText(BAND_LABEL_STRINGS[index] ?? '');
    setRangeText(BAND_HZ_RANGES[index] ?? '');
    setColorText(BAND_COLORS[index] ?? '#FFFFFF');
  }, []);

  useAnimatedReaction(
    () => bandIndex.value,
    idx => {
      runOnJS(onBandChange)(idx);
    },
    [onBandChange],
  );

  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: bandOpacity.value,
  }));

  return (
    <Animated.View style={[styles.row, containerAnimStyle]}>
      <Text style={[styles.label, {color: colorText}]}>{labelText}</Text>
      <Text style={styles.range}>{rangeText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  label: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  range: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
  },
});
