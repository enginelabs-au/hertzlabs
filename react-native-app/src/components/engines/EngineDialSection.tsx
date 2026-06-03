import React, {useCallback, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useDialSharedValues} from '../CircularController/useDialSharedValues';
import {useDialGestures} from '../CircularController/useDialGestures';
import {useAudioSharedValues} from '../../hooks/useAudioSharedValues';
import {FramedVisualizerHub} from '../player/FramedVisualizerHub';
import {NeonSlider} from '../player/NeonSlider';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

function gainToDb(gain: number): string {
  if (gain <= 0.0001) {
    return '−∞';
  }
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
}

/**
 * Central dial + embedded phase slider + gain row.
 */
export function EngineDialSection() {
  const dialValues = useDialSharedValues();
  const {composedGesture} = useDialGestures(dialValues);
  useAudioSharedValues(dialValues);
  const gain = useHertzStore(s => s.gain);
  const setParam = useHertzStore(s => s.setParam);

  const dbLabel = useMemo(() => gainToDb(gain), [gain]);

  return (
    <View style={styles.wrap}>
      <FramedVisualizerHub dialValues={dialValues} gesture={composedGesture} />
      <View style={styles.gainRow}>
        <Text style={styles.speaker}>🔈</Text>
        <View style={styles.gainSliderFlex}>
          <NeonSlider value={gain} onChange={v => setParam('gain', v)} accent={HertzTheme.neon.cyan} />
        </View>
        <Text style={styles.dbUnit}>dB</Text>
        <Text style={styles.dbValue}>{dbLabel}</Text>
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
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  gainSliderFlex: {
    flex: 1,
  },
  speaker: {
    fontSize: 14,
    opacity: 0.6,
  },
  dbUnit: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.text.muted,
  },
  dbValue: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: HertzTheme.text.secondary,
    minWidth: 36,
  },
});
