import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {formatBeatDisplay, formatBeatUnit, getBand} from '../ReadoutPanel/brainwaveBands';
import {HertzTheme} from '../../theme/hertzTheme';

type HubTargetReadoutProps = {
  beatHz: number;
};

/** Centre TARGET readout — Hz + band name tinted to active band colour. */
export function HubTargetReadout({beatHz}: HubTargetReadoutProps) {
  const band = getBand(beatHz);
  const display = formatBeatDisplay(beatHz);

  return (
    <View style={styles.disc}>
      <Text style={[styles.hz, {color: band.hexColor}]}>{display}</Text>
      <Text style={styles.hzUnit}>{formatBeatUnit(beatHz)}</Text>
      <Text style={[styles.bandName, {color: band.hexColor}]}>{band.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  hz: {
    fontFamily: HertzTheme.mono,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 28,
  },
  hzUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    marginTop: -2,
  },
  bandName: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
    textAlign: 'center',
  },
});
