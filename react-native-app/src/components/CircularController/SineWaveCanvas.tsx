import React, {useMemo} from 'react';
import {useWindowDimensions} from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import {
  BlurMask,
  Canvas,
  Fill,
  Group,
  Path,
  Shader,
} from '@shopify/react-native-skia';
import type {DialValues} from './useDialSharedValues';
import {sineWaveEffect} from './SineWaveShader';
import {makeDialPaths, DIAL_SIZE as DIAL_SIZE_DEFAULT} from './DialRingPath';

/**
 * Per-layer RGBA tint colors as float4 arrays (each channel 0–1).
 * Passed as `tintColor` uniform so the SkSL shader can produce full color output.
 */
const LAYER_RGBA: readonly [number, number, number, number][] = [
  [75 / 255, 120 / 255, 255 / 255, 0.7], // indigo-blue
  [100 / 255, 200 / 255, 180 / 255, 0.6], // teal
  [200 / 255, 100 / 255, 255 / 255, 0.5], // violet
  [255 / 255, 160 / 255, 60 / 255, 0.4], // amber
] as const;

interface ShaderLayerProps {
  index: number;
  size: number;
  dialValues: DialValues;
  clockMs: ReturnType<typeof useSharedValue<number>>;
}

/**
 * One animated sine-wave layer.
 * All uniform derivation happens on the UI thread via `useDerivedValue` —
 * zero JS callbacks per frame.
 */
function ShaderLayer({index, size, dialValues, clockMs}: ShaderLayerProps) {
  const {beatHz, phaseAngle, timingDiffMs, gestureActive} = dialValues;
  const tint = LAYER_RGBA[index];

  const uniforms = useDerivedValue(() => ({
    time: clockMs.value / 1000,
    frequency: beatHz.value / 100,
    phase: (phaseAngle.value * Math.PI) / 180,
    ripple: gestureActive.value ? 1.0 : 0.0,
    warpAmount: timingDiffMs.value / 500,
    resolution: [size, size],
    layerIndex: index,
    tintColor: tint,
  }));

  return (
    <Fill>
      <Shader source={sineWaveEffect} uniforms={uniforms} />
    </Fill>
  );
}

/**
 * Pure draw component — never issues gesture handlers (those live in
 * CircularController above it in the tree). `pointerEvents="none"` is
 * applied on the wrapping View in CircularController.
 */
export function SineWaveCanvas({dialValues}: {dialValues: DialValues}) {
  const {width: screenWidth} = useWindowDimensions();
  const size = Math.min(screenWidth - 32, DIAL_SIZE_DEFAULT);

  const {clipPath, ringPath, markerPath} = useMemo(
    () => makeDialPaths(size),
    [size],
  );

  // Monotonic frame clock — drives smooth time-based shader animation without
  // touching the JS thread on every frame.
  const clockMs = useSharedValue(0);
  useFrameCallback(({timestamp}) => {
    clockMs.value = timestamp;
  });

  // Animated blur for the glow halo: wider when a gesture is active.
  const glowBlur = useDerivedValue(() =>
    dialValues.gestureActive.value ? 12 : 4,
  );

  return (
    <Canvas style={{width: size, height: size}} pointerEvents="none">
      <Group clip={clipPath}>
        <ShaderLayer index={0} size={size} dialValues={dialValues} clockMs={clockMs} />
        <ShaderLayer index={1} size={size} dialValues={dialValues} clockMs={clockMs} />
        <ShaderLayer index={2} size={size} dialValues={dialValues} clockMs={clockMs} />
        <ShaderLayer index={3} size={size} dialValues={dialValues} clockMs={clockMs} />

        {/* Static ring outline */}
        <Path
          path={ringPath}
          color="rgba(255, 255, 255, 0.18)"
          style="stroke"
          strokeWidth={1.5}
        />

        {/* Animated glow halo — blur expands on gesture */}
        <Path
          path={ringPath}
          color="rgba(120, 180, 255, 0.35)"
          style="stroke"
          strokeWidth={3}>
          <BlurMask blur={glowBlur} style="normal" />
        </Path>

        {/* 45° tick marks */}
        <Path
          path={markerPath}
          color="rgba(255, 255, 255, 0.45)"
          style="stroke"
          strokeWidth={1.5}
        />
      </Group>
    </Canvas>
  );
}
