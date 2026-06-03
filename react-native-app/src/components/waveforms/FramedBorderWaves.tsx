import React from 'react';
import {useDerivedValue, useFrameCallback, useSharedValue} from 'react-native-reanimated';
import {Canvas, Path} from '@shopify/react-native-skia';
import {buildOscilloscopeTrace, stereoHzFromBinaural} from '../../audio/oscilloscopeMath';
import {HertzTheme} from '../../theme/hertzTheme';
import type {DialValues} from '../CircularController/useDialSharedValues';

const STROKE_TOP = HertzTheme.neon.cyan;
const STROKE_LEFT = HertzTheme.neon.purple;

type FramedBorderWavesProps = {
  width: number;
  height: number;
  dialValues: DialValues;
};

/**
 * Top + left frame edges — scrolling L/R tone traces (time-domain oscilloscope).
 */
export function FramedBorderWaves({width, height, dialValues}: FramedBorderWavesProps) {
  const time = useSharedValue(0);
  useFrameCallback(({timestamp}) => {
    time.value = timestamp / 1000;
  });

  const topPath = useDerivedValue(() => {
    'worklet';
    const {leftHz} = stereoHzFromBinaural(
      dialValues.carrierHz.value,
      dialValues.beatHz.value,
    );
    return buildOscilloscopeTrace({
      length: width - 20,
      center: 12,
      amplitude: 9,
      hz: leftHz,
      timeSec: time.value,
      orientation: 'horizontal',
      gain: dialValues.gain.value,
    });
  });

  const leftPath = useDerivedValue(() => {
    'worklet';
    const {rightHz} = stereoHzFromBinaural(
      dialValues.carrierHz.value,
      dialValues.beatHz.value,
    );
    const phaseRad = (dialValues.phaseAngle.value * Math.PI) / 180;
    return buildOscilloscopeTrace({
      length: height - 36,
      center: 11,
      amplitude: 8,
      hz: rightHz,
      timeSec: time.value,
      orientation: 'vertical',
      phaseRad,
      gain: dialValues.gain.value,
    });
  });

  return (
    <Canvas style={{width, height, position: 'absolute', top: 0, left: 0}} pointerEvents="none">
      <Path
        path={topPath}
        color={STROKE_TOP}
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={leftPath}
        color={STROKE_LEFT}
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
        strokeJoin="round"
      />
    </Canvas>
  );
}
