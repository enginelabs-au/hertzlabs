import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useDialSharedValues} from '../CircularController/useDialSharedValues';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {useHertzStore} from '../../state/store';
import {HubOscilloscopeCanvas} from '../waveforms';
import {PhoticStrobeToggle} from '../waveforms/PhoticStrobeToggle';

const DEFAULT_W = 340;
const DEFAULT_H = 120;

type SimpleOscilloscopeProps = {
  width?: number;
  height?: number;
};

/** Lightweight dual-channel L/R oscilloscope for Simple Mode Engines. */
export function SimpleOscilloscope({width = DEFAULT_W, height = DEFAULT_H}: SimpleOscilloscopeProps) {
  const dialValues = useDialSharedValues();
  useAudioSharedValues(dialValues);
  const beatHz = useHertzStore(s => s.beatHz);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));

  return (
    <View style={styles.wrap}>
      <PhoticStrobeToggle />
      <View style={[styles.scopeBox, {width, height}]}>
        <HubOscilloscopeCanvas
          width={width}
          height={height}
          dialValues={dialValues}
          leftDriftHz={leftDriftHz}
          rightDriftHz={rightDriftHz}
          beatHz={beatHz}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: '100%',
  },
  scopeBox: {
    position: 'relative',
    overflow: 'hidden',
  },
});
