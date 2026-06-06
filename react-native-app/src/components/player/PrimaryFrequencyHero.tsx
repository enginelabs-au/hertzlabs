import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {formatBeatDisplay, formatBeatUnit, getBand} from '../ReadoutPanel/brainwaveBands';
import {HertzTheme, bandActionLabel} from '../../theme/hertzTheme';
import {useHertzStore} from '../../state/store';

export function PrimaryFrequencyHero() {
  const beatHz = useHertzStore(s => s.beatHz);
  const band = getBand(beatHz);
  const badge = bandActionLabel(band.label);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.hz, {color: band.hexColor}]}>
          {formatBeatDisplay(beatHz)} {formatBeatUnit(beatHz)}
        </Text>
        <Text style={styles.subtitle}>{band.label}</Text>
      </View>
      <View style={[styles.badge, {borderColor: `${band.hexColor}88`, backgroundColor: `${band.hexColor}22`}]}>
        <Text style={[styles.badgeText, {color: band.hexColor}]}>{badge}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  left: {
    flex: 1,
  },
  hz: {
    fontSize: 42,
    fontWeight: '300',
    color: HertzTheme.text.accent,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: HertzTheme.text.secondary,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: HertzTheme.neon.purple,
  },
});
