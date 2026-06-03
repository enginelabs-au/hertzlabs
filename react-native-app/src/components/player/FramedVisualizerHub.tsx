import React, {useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {beatHzToSliderNorm, sliderNormToBeatHz} from '../../audio/beatHzSlider';
import {useHubLayout} from '../../hooks/useHubLayout';
import type {DialValues} from '../CircularController/useDialSharedValues';
import type {useDialGestures} from '../CircularController/useDialGestures';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {HubOscilloscopeCanvas} from '../waveforms/HubOscilloscopeCanvas';
import {GlassCard} from './GlassCard';
import {NeonSlider} from './NeonSlider';
import {NeonVerticalSlider} from './NeonVerticalSlider';

type FramedVisualizerHubProps = {
  dialValues: DialValues;
  gesture: ReturnType<typeof useDialGestures>['composedGesture'];
};

export function FramedVisualizerHub({dialValues, gesture}: FramedVisualizerHubProps) {
  const {hubW, hubH, canvasW} = useHubLayout();
  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const beat = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);

  const beatNorm = beatHzToSliderNorm(beat, tier);

  const onBeatSlider = useCallback(
    (v: number) => {
      setParam('beatHz', sliderNormToBeatHz(v, tier));
    },
    [setParam, tier],
  );

  const onPhaseChange = useCallback((deg: number) => setParam('phaseAngle', deg), [setParam]);

  return (
    <View style={styles.outer}>
      <GlassCard style={[styles.frame, {width: hubW, height: hubH}]} padding={0}>
        <View style={[styles.hubInner, {width: hubW, height: hubH}]}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.canvasBox, {width: canvasW, height: hubH}]}>
              <HubOscilloscopeCanvas width={canvasW} height={hubH} dialValues={dialValues} />
            </View>
          </GestureDetector>
          <NeonVerticalSlider
            embedded
            valueDeg={phaseAngle}
            onChangeDeg={onPhaseChange}
            accent={HertzTheme.neon.purple}
            height={hubH}
          />
        </View>
      </GlassCard>

      <View style={[styles.sliderWrap, {width: hubW}]}>
        <View style={styles.sliderFlex}>
          <NeonSlider value={beatNorm} onChange={onBeatSlider} />
        </View>
        <Text style={styles.unit}>Hz</Text>
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
  hubInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  canvasBox: {
    backgroundColor: 'transparent',
  },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  sliderFlex: {
    flex: 1,
  },
  unit: {
    fontFamily: HertzTheme.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HertzTheme.text.muted,
    minWidth: 22,
  },
});
