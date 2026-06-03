import React from 'react';
import {useDerivedValue, useFrameCallback, useSharedValue} from 'react-native-reanimated';
import {Canvas, Group, Path} from '@shopify/react-native-skia';
import {buildLissajousPath, stereoHzFromBinaural} from '../../audio/oscilloscopeMath';
import {HertzTheme} from '../../theme/hertzTheme';
import type {DialValues} from '../CircularController/useDialSharedValues';

type LissajousCanvasProps = {
  width: number;
  height: number;
  dialValues: DialValues;
};

/**
 * XY oscilloscope (L/R binaural samples) — sharp strokes, no glow blur.
 */
export function LissajousCanvas({width, height, dialValues}: LissajousCanvasProps) {
  const time = useSharedValue(0);
  useFrameCallback(({timestamp}) => {
    time.value = timestamp / 1000;
  });

  const cx = width * 0.52;
  const cy = height * 0.48;
  const scale = Math.min(width, height) * 0.34;

  const pathCyan = useDerivedValue(() => {
    'worklet';
    const {leftHz, rightHz} = stereoHzFromBinaural(
      dialValues.carrierHz.value,
      dialValues.beatHz.value,
    );
    return buildLissajousPath({
      cx,
      cy,
      scale,
      leftHz,
      rightHz,
      phaseDeg: dialValues.phaseAngle.value,
      gain: dialValues.gain.value,
      balance: dialValues.balance.value,
      timeSec: time.value,
      pointCount: 200,
    });
  });

  const pathViolet = useDerivedValue(() => {
    'worklet';
    const {leftHz, rightHz} = stereoHzFromBinaural(
      dialValues.carrierHz.value,
      dialValues.beatHz.value,
    );
    return buildLissajousPath({
      cx,
      cy,
      scale: scale * 0.98,
      leftHz,
      rightHz,
      phaseDeg: dialValues.phaseAngle.value + 90,
      gain: dialValues.gain.value * 0.5,
      balance: dialValues.balance.value,
      timeSec: time.value,
      pointCount: 200,
    });
  });

  return (
    <Canvas style={{width, height}} pointerEvents="none">
      <Group>
        <Path
          path={pathViolet}
          color={HertzTheme.neon.purple}
          style="stroke"
          strokeWidth={1}
          strokeCap="round"
          strokeJoin="round"
          opacity={0.45}
        />
        <Path
          path={pathCyan}
          color={HertzTheme.neon.cyan}
          style="stroke"
          strokeWidth={1.75}
          strokeCap="round"
          strokeJoin="round"
        />
      </Group>
    </Canvas>
  );
}
