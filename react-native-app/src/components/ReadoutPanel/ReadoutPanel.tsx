import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import {useHertzStore} from '../../state/store';
import type {DialValues} from '../CircularController/useDialSharedValues';
import {BandLabel} from './BandLabel';
import {FrequencyDisplay} from './FrequencyDisplay';
import {PhaseDisplay} from './PhaseDisplay';
import {TimingDisplay} from './TimingDisplay';
import {HertzTheme} from '../../theme/hertzTheme';

interface ReadoutPanelProps {
  dialValues: DialValues;
  bandIndex: SharedValue<number>;
  bandOpacity: SharedValue<number>;
}

/**
 * Readout panel per spec — 6 rows:
 *
 *   [ ALPHA ]      band label
 *   ENGINE         active engine type
 *   L CHAN  200.0  Hz
 *   R CHAN  210.0  Hz
 *   TARGET Δ  10.0  Hz  (amber if highVolumeWarning)
 *   PHASE   135.0  °
 *   TIMING  +12.0  ms
 */
export function ReadoutPanel({dialValues, bandIndex, bandOpacity}: ReadoutPanelProps) {
  const engineType = useHertzStore(s => s.engineType);

  return (
    <View style={styles.container}>
      <BandLabel bandIndex={bandIndex} bandOpacity={bandOpacity} />
      <View style={styles.divider} />
      <FrequencyDisplay
        carrierHz={dialValues.carrierHz}
        beatHz={dialValues.beatHz}
        engineType={engineType}
      />
      <View style={styles.spacer} />
      <PhaseDisplay phaseAngle={dialValues.phaseAngle} />
      <View style={styles.spacer} />
      <TimingDisplay timingDiffMs={dialValues.timingDiffMs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: HertzTheme.glassFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    minWidth: 280,
    marginHorizontal: 16,
  },
  divider: {
    height: 1,
    backgroundColor: HertzTheme.glassBorder,
    marginVertical: 10,
  },
  spacer: {
    height: 6,
  },
});
