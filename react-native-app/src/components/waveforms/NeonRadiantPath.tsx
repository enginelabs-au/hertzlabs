import React from 'react';
import {Group, Path} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import type {SharedValue} from 'react-native-reanimated';
import type {RadiantStrokeStyle} from './radiantWavePalette';

type PathSource = SharedValue<SkPath> | SkPath;

type NeonRadiantPathProps = {
  path: PathSource;
  stroke: RadiantStrokeStyle;
  /** Core line width — kept thin; outer layers scale from this */
  strokeWidth?: number;
};

/**
 * Layered neon stroke (halo → glow → core). Uses Group — Fragments/BlurMask break Skia SG on Fabric.
 */
export function NeonRadiantPath({path, stroke, strokeWidth = 1.25}: NeonRadiantPathProps) {
  const glowW = strokeWidth + 0.85;
  const haloW = strokeWidth + 2;

  return (
    <Group>
      <Path
        path={path}
        color={stroke.halo}
        style="stroke"
        strokeWidth={haloW}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={path}
        color={stroke.glow}
        style="stroke"
        strokeWidth={glowW}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={path}
        color={stroke.core}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}
