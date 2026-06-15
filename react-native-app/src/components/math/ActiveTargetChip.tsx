import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {getBand} from '../ReadoutPanel/brainwaveBands';
import {HertzTheme} from '../../theme/hertzTheme';

type ActiveTargetChipProps = {
  hz: number;
  formulaPrimary?: string;
  formulaSecondary?: string;
};

export function ActiveTargetChip({hz, formulaPrimary, formulaSecondary}: ActiveTargetChipProps) {
  const band = getBand(hz);
  const tint = `${band.hexColor}22`;
  const border = `${band.hexColor}66`;

  return (
    <View style={[styles.chip, {backgroundColor: tint, borderColor: border}]}>
      <Text style={styles.label}>ACTIVE TARGET Δ</Text>
      <Text style={[styles.hz, {color: band.hexColor}]}>{hz.toFixed(2)} Hz</Text>
      <View style={[styles.bandBadge, {borderColor: border, backgroundColor: `${band.hexColor}18`}]}>
        <Text style={[styles.bandText, {color: band.hexColor}]}>
          {band.scientific} · {band.rangeLabel}
        </Text>
      </View>
      {formulaPrimary != null && formulaPrimary.length > 0 && (
        <Text style={styles.formula} numberOfLines={2}>
          {formulaPrimary}
        </Text>
      )}
      {formulaSecondary != null && formulaSecondary.length > 0 && (
        <Text style={styles.formulaSub} numberOfLines={3}>
          {formulaSecondary}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
    letterSpacing: 1,
  },
  hz: {
    fontFamily: HertzTheme.mono,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  bandBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  bandText: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  formula: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.secondary,
    marginTop: 10,
    textAlign: 'center',
  },
  formulaSub: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 15,
  },
});
