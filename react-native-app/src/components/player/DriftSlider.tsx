import React, {useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {clampDriftHz, driftHzFromNorm, driftNormFromHz} from '../../audio/channelFrequencies';
import {HertzTheme} from '../../theme/hertzTheme';
import {NeonSlider} from './NeonSlider';

type DriftSliderProps = {
  label: string;
  driftHz: number;
  onChange: (hz: number) => void;
  accent?: string;
};

/** Compact horizontal per-ear frequency drift (−12…+12 Hz). */
export function DriftSlider({label, driftHz, onChange, accent = HertzTheme.neon.cyan}: DriftSliderProps) {
  const hz = clampDriftHz(driftHz);
  const norm = driftNormFromHz(hz);

  const onNorm = useCallback((n: number) => onChange(driftHzFromNorm(n)), [onChange]);

  const display = hz === 0 ? '0 Hz' : `${hz > 0 ? '+' : ''}${hz.toFixed(1)} Hz`;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.hz, {color: accent}]}>{display}</Text>
      </View>
      <NeonSlider value={norm} onChange={onNorm} accent={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingTop: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 0.8,
  },
  hz: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '600',
  },
});
