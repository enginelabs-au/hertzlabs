import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {DEFAULT_VOLUME_GAIN} from '../../audio/paramMapping';
import {RadialKnob} from '../player/RadialKnob';
import {HertzTheme} from '../../theme/hertzTheme';

type HubVolumeKnobProps = {
  gain: number;
  onChangeGain: (g: number) => void;
};

function gainToDb(gain: number): string {
  if (gain <= 0.0001) {
    return '−∞';
  }
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

/** Prominent volume knob — sits under the centre TARGET readout. */
export function HubVolumeKnob({gain, onChangeGain}: HubVolumeKnobProps) {
  const onKnobChange = useCallback((v: number) => onChangeGain(Math.min(1, Math.max(0, v))), [onChangeGain]);

  return (
    <View style={styles.wrap}>
      <RadialKnob
        size="large"
        label="VOLUME"
        value={gain}
        min={0}
        max={1}
        onChange={onKnobChange}
        color={HertzTheme.channel.volume}
        format={gainToDb}
        defaultValue={DEFAULT_VOLUME_GAIN}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    alignItems: 'center',
  },
});
