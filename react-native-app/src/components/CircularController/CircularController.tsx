import React from 'react';
import {StyleSheet, View} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {useDialSharedValues} from './useDialSharedValues';
import {useDialGestures} from './useDialGestures';
import {SineWaveCanvas} from './SineWaveCanvas';
import {DIAL_SIZE} from './DialRingPath';
import {useBrainwaveBand} from '../../hooks/useBrainwaveBand';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {ReadoutPanel} from '../ReadoutPanel/ReadoutPanel';

/**
 * Self-contained circular gesture controller.
 *
 * Owns the full dial → gesture → Zustand pipeline:
 *   1. useDialSharedValues   — allocates all six UI-thread shared values
 *   2. useDialGestures       — wires RNGH pan/rotation gestures + Zustand commit bridge
 *   3. useBrainwaveBand      — derives bandIndex/bandOpacity from beatHz
 *   4. useAudioSharedValues  — syncs Zustand → shared values on mount and store changes
 *
 * Layer order inside GestureDetector (back to front):
 *   SineWaveCanvas  — GPU Skia shader canvas (pointerEvents="none")
 *   gesture surface — transparent capture layer (pointerEvents="box-only")
 */
export function CircularController() {
  const dialValues = useDialSharedValues();
  const {composedGesture} = useDialGestures(dialValues);
  const {bandIndex, bandOpacity} = useBrainwaveBand(dialValues.beatHz);
  useAudioSharedValues(dialValues);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.wrapper}>
          <SineWaveCanvas dialValues={dialValues} />
          <View style={styles.gestureSurface} pointerEvents="box-only" />
        </View>
      </GestureDetector>
      <ReadoutPanel
        dialValues={dialValues}
        bandIndex={bandIndex}
        bandOpacity={bandOpacity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  wrapper: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    position: 'relative',
  },
  gestureSurface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
