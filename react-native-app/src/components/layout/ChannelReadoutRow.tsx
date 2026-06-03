import React, {useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {channelFrequencies, clampDriftHz} from '../../audio/channelFrequencies';
import {getBand} from '../ReadoutPanel/brainwaveBands';
import {DriftSlider} from '../player/DriftSlider';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/** LEFT · TARGET · RIGHT readouts with per-ear drift sliders. */
export function ChannelReadoutRow() {
  const carrier = useHertzStore(s => s.carrierHz);
  const beat = useHertzStore(s => s.beatHz);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));
  const setParam = useHertzStore(s => s.setParam);

  const onLeftDrift = useCallback((hz: number) => setParam('leftDriftHz', hz), [setParam]);
  const onRightDrift = useCallback((hz: number) => setParam('rightDriftHz', hz), [setParam]);

  const {leftHz, rightHz} = channelFrequencies(carrier, beat, leftDriftHz, rightDriftHz);
  const band = getBand(beat);
  const bandColor = band.hexColor;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.sideCol}>
          <View style={styles.sideCard}>
            <Text style={styles.sideLabel}>LEFT</Text>
            <Text style={styles.sideHz}>{leftHz.toFixed(1)}</Text>
            <Text style={[styles.sideUnit, {color: HertzTheme.neon.cyan}]}>Hz</Text>
          </View>
          <DriftSlider
            label="DRIFT L"
            driftHz={leftDriftHz}
            onChange={onLeftDrift}
            accent={HertzTheme.neon.cyan}
          />
        </View>

        <View style={[styles.targetCard, {borderColor: `${bandColor}66`}]}>
          <Text style={[styles.targetLabel, {color: bandColor}]}>TARGET</Text>
          <Text style={[styles.targetHz, {color: bandColor}]}>{beat.toFixed(2)}</Text>
          <Text style={[styles.targetUnit, {color: bandColor}]}>Hz</Text>
          <View style={[styles.bandPill, {borderColor: `${bandColor}99`, backgroundColor: `${bandColor}22`}]}>
            <Text style={[styles.bandPillText, {color: bandColor}]}>{band.label}</Text>
          </View>
        </View>

        <View style={styles.sideCol}>
          <View style={styles.sideCard}>
            <Text style={styles.sideLabel}>RIGHT</Text>
            <Text style={[styles.sideHz, styles.rightHz]}>{rightHz.toFixed(1)}</Text>
            <Text style={styles.sideUnit}>Hz</Text>
          </View>
          <DriftSlider
            label="DRIFT R"
            driftHz={rightDriftHz}
            onChange={onRightDrift}
            accent={HertzTheme.neon.purple}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  sideCol: {
    flex: 1,
  },
  sideCard: {
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
    fontSize: 22,
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
