import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {getBand} from '../ReadoutPanel/brainwaveBands';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** LEFT · TARGET · RIGHT channel cards (Engines screen header). */
export function ChannelReadoutRow() {
  const carrier = useHertzStore(s => s.carrierHz);
  const beat = useHertzStore(s => s.beatHz);
  const left = carrier - beat / 2;
  const right = carrier + beat / 2;
  const band = getBand(beat);
  const bandColor = band.hexColor;

  return (
    <View style={styles.row}>
      <View style={styles.sideCard}>
        <Text style={styles.sideLabel}>LEFT</Text>
        <Text style={styles.sideHz}>{Math.round(left)}</Text>
        <Text style={[styles.sideUnit, {color: HertzTheme.neon.cyan}]}>Hz</Text>
      </View>

      <View style={[styles.targetCard, {borderColor: `${bandColor}66`}]}>
        <Text style={[styles.targetLabel, {color: bandColor}]}>TARGET</Text>
        <Text style={[styles.targetHz, {color: bandColor}]}>{beat.toFixed(2)}</Text>
        <Text style={[styles.targetUnit, {color: bandColor}]}>Hz</Text>
        <View style={[styles.bandPill, {borderColor: `${bandColor}99`, backgroundColor: `${bandColor}22`}]}>
          <Text style={[styles.bandPillText, {color: bandColor}]}>{band.label}</Text>
        </View>
      </View>

      <View style={styles.sideCard}>
        <Text style={styles.sideLabel}>RIGHT</Text>
        <Text style={[styles.sideHz, styles.rightHz]}>{Math.round(right)}</Text>
        <Text style={styles.sideUnit}>Hz</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  sideCard: {
    flex: 1,
    backgroundColor: HertzTheme.glassFill,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sideLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    letterSpacing: 1,
  },
  sideHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 26,
    fontWeight: '600',
    color: HertzTheme.neon.cyan,
    marginTop: 2,
  },
  rightHz: {
    color: HertzTheme.text.secondary,
  },
  sideUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.muted,
  },
  targetCard: {
    flex: 1.15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  targetHz: {
    fontFamily: HertzTheme.mono,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 2,
  },
  targetUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
  },
  bandPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  bandPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
