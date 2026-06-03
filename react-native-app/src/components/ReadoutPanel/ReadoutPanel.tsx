import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import {useHertzStore} from '../../state/store';
import type {DialValues} from '../CircularController/useDialSharedValues';
import {BandLabel} from './BandLabel';
import {FrequencyDisplay} from './FrequencyDisplay';
import {PhaseDisplay} from './PhaseDisplay';
import {TimingDisplay} from './TimingDisplay';

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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 280,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  spacer: {
    height: 6,
  },
});
