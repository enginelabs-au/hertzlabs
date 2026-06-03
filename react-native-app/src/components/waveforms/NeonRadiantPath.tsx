import React from 'react';
import {BlurMask, Path} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import type {SharedValue} from 'react-native-reanimated';
import type {RadiantStrokeStyle} from './radiantWavePalette';

type PathSource = SharedValue<SkPath> | SkPath;

type NeonRadiantPathProps = {
  path: PathSource;
  stroke: RadiantStrokeStyle;
  /** Core line width — kept thin; glow layers scale from this */
  strokeWidth?: number;
};

/**
 * Three-pass neon stroke: soft halo, mid glow, thin bright core (shader-like).
 */
export function NeonRadiantPath({path, stroke, strokeWidth = 1.25}: NeonRadiantPathProps) {
  const glowW = strokeWidth + 0.85;
  const haloW = strokeWidth + 2;

  return (
    <>
      <Path path={path} color={stroke.halo} style="stroke" strokeWidth={haloW}>
        <BlurMask blur={18} style="normal" />
      </Path>
      <Path path={path} color={stroke.glow} style="stroke" strokeWidth={glowW}>
        <BlurMask blur={9} style="normal" />
      </Path>
      <Path path={path} color={stroke.core} style="stroke" strokeWidth={strokeWidth}>
        <BlurMask blur={2.5} style="solid" />
      </Path>
    </>
  );
}
