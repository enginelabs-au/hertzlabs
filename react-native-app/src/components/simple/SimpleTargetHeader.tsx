import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {formatBeatDisplay, formatBeatUnit, getBand} from '../ReadoutPanel/brainwaveBands';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** Simple Mode target readout — beat Hz + band label only. */
export function SimpleTargetHeader() {
  const beatHz = useHertzStore(s => s.beatHz);
  const band = getBand(beatHz);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hz, {color: band.hexColor}]}>{formatBeatDisplay(beatHz)}</Text>
      <Text style={styles.unit}>{formatBeatUnit(beatHz)}</Text>
      <Text style={[styles.band, {color: band.hexColor}]}>{band.scientific.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  hz: {
    fontFamily: HertzTheme.mono,
    fontSize: 36,
    fontWeight: '700',
  },
  unit: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
    marginTop: -2,
  },
  band: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 6,
  },
});
