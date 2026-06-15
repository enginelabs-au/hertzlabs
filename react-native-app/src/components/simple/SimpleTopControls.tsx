import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {DEFAULT_VOLUME_GAIN} from '../../audio/paramMapping';
import {RadialKnob} from '../player/RadialKnob';
import {SimpleBeatSlider} from '../home/HomeFreqControls';
import {SimpleOscilloscope} from './SimpleOscilloscope';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';

function gainToDb(gain: number): string {
  if (gain <= 0.0001) {
    return '−∞';
  }
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

/** Volume dial with freq slider below it, oscilloscope beside. */
export function SimpleTopControls() {
  const gain = useHertzStore(s => s.gain);
  const setParam = useHertzStore(s => s.setParam);

  const onGainChange = useCallback(
    (g: number) => setParam('gain', Math.min(1, Math.max(0, g))),
    [setParam],
  );

  return (
    <View style={styles.row}>
      <View style={styles.controlsCol}>
        <RadialKnob
          size="compact"
          label="VOLUME"
          value={gain}
          min={0}
          max={1}
          onChange={onGainChange}
          color={HertzTheme.channel.volume}
          format={gainToDb}
          defaultValue={DEFAULT_VOLUME_GAIN}
        />
        <SimpleBeatSlider compact />
      </View>
      <View style={styles.scopeCol}>
        <SimpleOscilloscope width={220} height={108} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
    gap: 10,
  },
  controlsCol: {
    width: 118,
    alignItems: 'center',
    gap: 6,
  },
  scopeCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
