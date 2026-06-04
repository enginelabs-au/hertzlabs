import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {useDialSharedValues} from '../CircularController/useDialSharedValues';
import type {DialValues} from '../CircularController/useDialSharedValues';
import {useDialGestures} from '../CircularController/useDialGestures';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {useLiveAudioParamBridge} from '../../hooks/useLiveAudioParamBridge';
import {useHubLayout} from '../../hooks/useHubLayout';
import {HubFrequencyBandBar} from '../hub/HubFrequencyBandBar';
import {FramedVisualizerHub} from '../player/FramedVisualizerHub';
import {useHertzStore} from '../../state/store';

type EngineDialSectionProps = {
  /** Shared values owned by the parent so sibling readouts can follow them live. */
  dialValues?: DialValues;
};

/**
 * Visualizer hub + external brainwave band strip (above engine category tabs).
 */
export function EngineDialSection({dialValues: dialValuesProp}: EngineDialSectionProps = {}) {
  // Always create a local set (hooks must be unconditional); prefer the parent's
  // when provided so a sibling readout row can share the same shared values.
  const ownDialValues = useDialSharedValues();
  const dialValues = dialValuesProp ?? ownDialValues;
  const {composedGesture} = useDialGestures(dialValues);
  useAudioSharedValues(dialValues);
  useLiveAudioParamBridge(dialValues);
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
