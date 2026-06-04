import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {runOnJS, useAnimatedReaction, useSharedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {
  beatHzLimitsForTier,
  beatHzToSliderNorm,
  sliderNormToBeatHz,
} from '../../audio/beatHzSlider';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {useHubLayout, IN_FRAME_BEAT_SLIDER_H} from '../../hooks/useHubLayout';
import type {DialValues} from '../CircularController/useDialSharedValues';
import type {useDialGestures} from '../CircularController/useDialGestures';
import {formatBeatDisplay, getBand} from '../ReadoutPanel/brainwaveBands';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {HubOscilloscopeCanvas} from '../waveforms';
import {GlassCard} from './GlassCard';
import {NeonSlider} from './NeonSlider';
import {NeonVerticalSlider} from './NeonVerticalSlider';

type FramedVisualizerHubProps = {
  dialValues: DialValues;
  gesture: ReturnType<typeof useDialGestures>['composedGesture'];
};

/**
 * Beat-Hz label under the slider that follows the live UI-thread value during a
 * drag. Isolated into its own component so per-frame updates re-render only this
 * text node — not the oscilloscope canvas or the sliders.
 */
function HubDockBeatLabel({beatSV, fallback}: {beatSV: SharedValue<number>; fallback: number}) {
  const [beat, setBeat] = useState(fallback);
  useEffect(() => setBeat(fallback), [fallback]);
  useAnimatedReaction(
    () => Math.round(beatSV.value * 10) / 10,
    (curr, prev) => {
      if (curr !== prev) {
        runOnJS(setBeat)(curr);
      }
    },
    [],
  );
  return (
    <Text style={[styles.beatLabel, {color: getBand(beat).hexColor}]}>
      {formatBeatDisplay(beat)} Hz
    </Text>
  );
}

export function FramedVisualizerHub({dialValues, gesture}: FramedVisualizerHubProps) {
  const {hubW, frameH, canvasH, canvasW, beatSliderW} = useHubLayout();

  const setParam = useHertzStore(s => s.setParam);
  const tier = useHertzStore(s => s.tier);
  const storeBeat = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));

  const bandHex = useMemo(() => getBand(storeBeat).hexColor, [storeBeat]);
  const beatNorm = beatHzToSliderNorm(storeBeat, tier);

  // Log-scale limits for the beat slider, mirrored onto the UI thread so the
  // slider can map drag → Hz in a worklet (no bridge traffic during drag).
  const {min: beatMin, max: beatMax} = beatHzLimitsForTier(tier);
  const beatLogMin = useSharedValue(Math.log(beatMin));
  const beatLogSpan = useSharedValue(Math.log(beatMax) - Math.log(beatMin));
  useEffect(() => {
    beatLogMin.value = Math.log(beatMin);
    beatLogSpan.value = Math.log(beatMax) - Math.log(beatMin);
  }, [beatMin, beatMax, beatLogMin, beatLogSpan]);

  const onBeatSliderComplete = useCallback(
    (v: number) => {
      setParam('beatHz', sliderNormToBeatHz(v, tier));
    },
    [setParam, tier],
  );

  const onPhaseComplete = useCallback(
    (deg: number) => {
      setParam('phaseAngle', deg);
    },
    [setParam],
  );

  return (
    <View style={styles.outer}>
      <GlassCard style={[styles.frame, {width: hubW, height: frameH}]} padding={0}>
        <View style={[styles.hubInner, {width: hubW, height: frameH}]}>
          <View style={[styles.canvasColumn, {width: canvasW, height: frameH}]}>
            <GestureDetector gesture={gesture}>
              <View style={[styles.canvasBox, {width: canvasW, height: canvasH}]}>
                <HubOscilloscopeCanvas
                  width={canvasW}
                  height={canvasH}
                  dialValues={dialValues}
                  leftDriftHz={leftDriftHz}
                  rightDriftHz={rightDriftHz}
                  bandHex={bandHex}
                  beatHz={storeBeat}
                  gain={gain}
                />
              </View>
            </GestureDetector>
            <View style={[styles.beatSliderDock, {width: canvasW, height: IN_FRAME_BEAT_SLIDER_H}]}>
              <HubDockBeatLabel beatSV={dialValues.beatHz} fallback={storeBeat} />
              <View style={{width: beatSliderW}}>
                <NeonSlider
                  value={beatNorm}
                  beatHzOut={dialValues.beatHz}
                  beatLogMin={beatLogMin}
                  beatLogSpan={beatLogSpan}
                  onChangeComplete={onBeatSliderComplete}
                  accent={bandHex}
                />
              </View>
            </View>
          </View>
          <NeonVerticalSlider
            embedded
            valueDeg={phaseAngle}
            linkedPhaseDeg={dialValues.phaseAngle}
            onChangeDegComplete={onPhaseComplete}
            accent={HertzTheme.channel.phase}
            height={frameH}
          />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  frame: {
    overflow: 'hidden',
  },
  hubInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  canvasColumn: {
    flexDirection: 'column',
  },
  canvasBox: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  beatSliderDock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  beatLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
