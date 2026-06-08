import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useDialSharedValues} from '../CircularController/useDialSharedValues';
import type {DialValues} from '../CircularController/useDialSharedValues';
import {useDialGestures} from '../CircularController/useDialGestures';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {useLiveAudioParamBridge} from '../../hooks/useLiveAudioParamBridge';
import {useKineticModulation} from '../../hooks/useKineticModulation';
import {FramedVisualizerHub} from '../player/FramedVisualizerHub';

type EngineDialSectionProps = {
  /** Shared values owned by the parent so sibling readouts can follow them live. */
  dialValues?: DialValues;
};

/**
 * Visualizer hub (oscilloscope + phase slider + the vertical brainwave band rail
 * down the left edge). The band rail lives inside the hub frame now — see
 * `FramedVisualizerHub` / `HubBandRail`.
 */
export function EngineDialSection({dialValues: dialValuesProp}: EngineDialSectionProps = {}) {
  // Always create a local set (hooks must be unconditional); prefer the parent's
  // when provided so a sibling readout row can share the same shared values.
  const ownDialValues = useDialSharedValues();
  const dialValues = dialValuesProp ?? ownDialValues;
  const {composedGesture} = useDialGestures(dialValues);
  useAudioSharedValues(dialValues);
  useLiveAudioParamBridge(dialValues);
  useKineticModulation(dialValues);

  return (
    <View style={styles.wrap}>
      <FramedVisualizerHub dialValues={dialValues} gesture={composedGesture} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 6,
  },
});
