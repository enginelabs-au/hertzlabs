import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {GlassCard} from '../player/GlassCard';
import {RadiantWaveStrip} from '../waveforms/RadiantWaveStrip';
import {HertzTheme} from '../../theme/hertzTheme';

type ScreenWaveHeaderProps = {
  height?: number;
  variant?: 'hero' | 'stacked';
  showAxes?: boolean;
  beatHz?: number;
};

/** Top waveform panel — used on Math, Background, and optional headers. */
export function ScreenWaveHeader({
  height = 100,
  variant = 'stacked',
  showAxes = true,
  beatHz,
}: ScreenWaveHeaderProps) {
  return (
    <GlassCard style={styles.wrap} padding={0}>
      {showAxes && (
        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>Y Amp</Text>
          <Text style={styles.axisLabelRight}>Frequency →</Text>
        </View>
      )}
      <RadiantWaveStrip height={height} variant={variant} beatHz={beatHz} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 72,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  axisLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
    letterSpacing: 0.5,
  },
  axisLabelRight: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
  },
});
