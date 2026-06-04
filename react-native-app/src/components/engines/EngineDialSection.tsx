import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {useDialSharedValues} from '../CircularController/useDialSharedValues';
import {useDialGestures} from '../CircularController/useDialGestures';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {useHubLayout} from '../../hooks/useHubLayout';
import {HubFrequencyBandBar} from '../hub/HubFrequencyBandBar';
import {FramedVisualizerHub} from '../player/FramedVisualizerHub';
import {useHertzStore} from '../../state/store';

/**
 * Visualizer hub + external brainwave band strip (above engine category tabs).
 */
export function EngineDialSection() {
  const dialValues = useDialSharedValues();
  const {composedGesture} = useDialGestures(dialValues);
  useAudioSharedValues(dialValues);
  const {hubW} = useHubLayout();
  const beat = useHertzStore(s => s.beatHz);
  const setParam = useHertzStore(s => s.setParam);

  const onBandSelect = useCallback(
    (midHz: number) => {
      setParam('beatHz', midHz);
    },
    [setParam],
  );

  return (
    <View style={styles.wrap}>
      <FramedVisualizerHub dialValues={dialValues} gesture={composedGesture} />
      <View style={[styles.bandBarOuter, {width: hubW}]}>
        <HubFrequencyBandBar beatHz={beat} width={hubW} onSelectBand={onBandSelect} standalone />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 6,
  },
  bandBarOuter: {
    alignSelf: 'center',
    marginTop: 8,
  },
});
