import React, {useCallback} from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {beatHzToSliderNorm, sliderNormToBeatHz} from '../../audio/beatHzSlider';
import type {DialValues} from '../CircularController/useDialSharedValues';
import type {useDialGestures} from '../CircularController/useDialGestures';
import {useHertzStore} from '../../state/store';
import {HubOscilloscopeCanvas} from '../waveforms/HubOscilloscopeCanvas';
import {GlassCard} from './GlassCard';
import {NeonSlider} from './NeonSlider';

type FramedVisualizerHubProps = {
  dialValues: DialValues;
  gesture: ReturnType<typeof useDialGestures>['composedGesture'];
};

export function FramedVisualizerHub({dialValues, gesture}: FramedVisualizerHubProps) {
  const {width} = useWindowDimensions();
  const hubW = width - 32;
  const hubH = Math.min(220, hubW * 0.55);
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const beat = useHertzStore(s => s.beatHz);

  const beatNorm = beatHzToSliderNorm(beat, tier);

  const onBeatSlider = useCallback(
    (v: number) => {
      setParam('beatHz', sliderNormToBeatHz(v, tier));
    },
    [setParam, tier],
  );

  return (
    <View style={styles.outer}>
      <GlassCard style={[styles.frame, {width: hubW, minHeight: hubH}]} padding={0}>
        <GestureDetector gesture={gesture}>
          <View style={[styles.gestureBox, {width: hubW, height: hubH}]}>
            <HubOscilloscopeCanvas width={hubW} height={hubH} dialValues={dialValues} />
          </View>
        </GestureDetector>
      </GlassCard>

      <View style={[styles.sliderWrap, {width: hubW}]}>
        <NeonSlider value={beatNorm} onChange={onBeatSlider} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  frame: {
    overflow: 'hidden',
  },
  gestureBox: {
    backgroundColor: 'transparent',
  },
  sliderWrap: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
});
