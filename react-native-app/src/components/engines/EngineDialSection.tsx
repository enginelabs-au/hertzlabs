import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useDialSharedValues} from '../CircularController/useDialSharedValues';
import {useDialGestures} from '../CircularController/useDialGestures';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {FramedVisualizerHub} from '../player/FramedVisualizerHub';
import {NeonSlider} from '../player/NeonSlider';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

/**
 * Central dial + gain slider — radiant framed hub (current waveforms).
 */
export function EngineDialSection() {
  const dialValues = useDialSharedValues();
  const {composedGesture} = useDialGestures(dialValues);
  useAudioSharedValues(dialValues);
  const gain = useHertzStore(s => s.gain);
  const setParam = useHertzStore(s => s.setParam);

  return (
    <View style={styles.wrap}>
      <FramedVisualizerHub dialValues={dialValues} gesture={composedGesture} />
      <View style={styles.gainRow}>
        <Text style={styles.speaker}>🔈</Text>
        <NeonSlider value={gain} onChange={v => setParam('gain', v)} accent={HertzTheme.neon.cyan} />
        <Text style={styles.speaker}>🔊</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 4,
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  speaker: {
    fontSize: 14,
    opacity: 0.6,
  },
});
