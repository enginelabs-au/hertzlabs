import React from 'react';
import {Group, Path} from '@shopify/react-native-skia';
import type {SkPath} from '@shopify/react-native-skia';
import {useDerivedValue} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import type {RadiantStrokeStyle} from './radiantWavePalette';

type PathSource = SharedValue<SkPath> | SkPath;

const FALLBACK_STROKE: RadiantStrokeStyle = {
  halo: 'rgba(92,225,255,0.24)',
  glow: 'rgba(92,225,255,0.52)',
  core: 'rgba(92,225,255,0.96)',
};

type NeonRadiantPathProps = {
  path: PathSource;
  /** Static stroke colours (commit-time). */
  stroke?: RadiantStrokeStyle;
  /** Live stroke colours on the UI thread — takes precedence over `stroke`. */
  strokeValue?: SharedValue<RadiantStrokeStyle>;
  /** Core line width — kept thin; outer layers scale from this */
  strokeWidth?: number;
};

/**
 * Layered neon stroke (halo → glow → core). Uses Group — Fragments/BlurMask break Skia SG on Fabric.
 * Each Skia colour is a derived value so a `strokeValue` shared value animates the
 * stroke on the UI thread (e.g. band hue following the beat slider live); when only
 * a static `stroke` is given the derived value is simply constant.
 */
export function NeonRadiantPath({path, stroke, strokeValue, strokeWidth = 1.25}: NeonRadiantPathProps) {
  const base = stroke ?? FALLBACK_STROKE;
  const haloColor = useDerivedValue(
    () => (strokeValue ? strokeValue.value.halo : base.halo),
    [strokeValue, base],
  );
  const glowColor = useDerivedValue(
    () => (strokeValue ? strokeValue.value.glow : base.glow),
    [strokeValue, base],
  );
  const coreColor = useDerivedValue(
    () => (strokeValue ? strokeValue.value.core : base.core),
    [strokeValue, base],
  );

  const glowW = strokeWidth + 0.85;
  const haloW = strokeWidth + 2;

  return (
    <Group>
      <Path
        path={path}
        color={haloColor}
        style="stroke"
        strokeWidth={haloW}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={path}
        color={glowColor}
        style="stroke"
        strokeWidth={glowW}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={path}
        color={coreColor}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}
