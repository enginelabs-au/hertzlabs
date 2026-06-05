import React, {memo, useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Canvas, Group} from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type {DialValues} from '../CircularController/useDialSharedValues';
import {buildHubScopePaths} from './hubPathBuilders';
import {HertzTheme} from '../../theme/hertzTheme';
import {bandStrokeFromHex} from './bandStrokeColors';
import {getBand} from '../ReadoutPanel/brainwaveBands';
import {NeonRadiantPath} from './NeonRadiantPath';

const CHANNEL_LEFT = HertzTheme.channel.left;
const CHANNEL_RIGHT = HertzTheme.channel.right;

type HubOscilloscopeCanvasProps = {
  width: number;
  height: number;
  /** Live UI-thread audio params — paths + colours follow these every frame (slider + dial). */
  dialValues: DialValues;
  leftDriftHz: number;
  rightDriftHz: number;
  /** Store-backed beat Hz — only drives stroke widths (snaps on commit; imperceptible). */
  beatHz: number;
};

/**
 * Hub oscilloscope — paths AND stroke colours rebuilt on the UI thread each frame
 * from `dialValues` shared values, so the waveform shape + band hue follow the beat
 * slider / dial live (no JS bridge traffic during drag). Mirrors LissajousCanvas /
 * FramedBorderWaves.
 */
function HubOscilloscopeCanvasInner({
  width,
  height,
  dialValues,
  leftDriftHz,
  rightDriftHz,
  beatHz,
}: HubOscilloscopeCanvasProps) {
  const w = Math.max(64, width);
  const h = Math.max(64, height);

  // Continuous UI-thread clock via a core Reanimated animation — render-independent
  // and not tied to useFrameCallback (which stalled here). time.value ≈ seconds.
  const time = useSharedValue(0);
  useEffect(() => {
    time.value = withRepeat(
      withTiming(100000, {duration: 100_000_000, easing: Easing.linear}),
      -1,
      false,
    );
    return () => cancelAnimation(time);
  }, [time]);

  const scope = useDerivedValue(
    () => {
      'worklet';
      return buildHubScopePaths(w, h, time.value, {
        carrierHz: dialValues.carrierHz.value,
        beatHz: dialValues.beatHz.value,
        phaseAngle: dialValues.phaseAngle.value,
        gain: dialValues.gain.value,
        balance: dialValues.balance.value,
        leftDriftHz,
        rightDriftHz,
      });
    },
    [w, h, leftDriftHz, rightDriftHz, dialValues],
  );

  const leftPath = useDerivedValue(() => scope.value.leftChannel, [scope]);
  const rightPath = useDerivedValue(() => scope.value.rightChannel, [scope]);
  const backPath = useDerivedValue(() => scope.value.lissajousBack, [scope]);
  const midPath = useDerivedValue(() => scope.value.lissajousMid, [scope]);
  const frontPath = useDerivedValue(() => scope.value.lissajousFront, [scope]);

  // Live stroke colours on the UI thread: band hue + intensity follow the beat
  // slider / dial every frame (getBand + bandStrokeFromHex are worklets).
  const liveStrokes = useDerivedValue(() => {
    'worklet';
    const beat = dialValues.beatHz.value;
    const g = dialValues.gain.value;
    const gainPart = Math.min(1, Math.max(0.4, g * 1.2));
    const beatPart = Math.min(1, Math.max(0.45, Math.log10(beat + 1) / 1.55));
    const intensity = Math.min(1, gainPart * (0.65 + beatPart * 0.55));
    const chIntensity = Math.min(1, intensity * 1.05);
    const hex = getBand(beat).hexColor;
    return {
      // Channel hues swapped per design: left trace = green, right trace = orange.
      left: bandStrokeFromHex(CHANNEL_RIGHT, chIntensity),
      right: bandStrokeFromHex(CHANNEL_LEFT, chIntensity),
      back: bandStrokeFromHex(hex, intensity * 0.48),
      mid: bandStrokeFromHex(hex, intensity * 0.72),
      front: bandStrokeFromHex(hex, intensity),
    };
  }, [dialValues]);

  const leftStroke = useDerivedValue(() => liveStrokes.value.left, [liveStrokes]);
  const rightStroke = useDerivedValue(() => liveStrokes.value.right, [liveStrokes]);
  const backStroke = useDerivedValue(() => liveStrokes.value.back, [liveStrokes]);
  const midStroke = useDerivedValue(() => liveStrokes.value.mid, [liveStrokes]);
  const frontStroke = useDerivedValue(() => liveStrokes.value.front, [liveStrokes]);

  // Stroke widths track the brainwave-band "boost"; store-backed so they snap on
  // commit (a sub-pixel change — not worth per-frame work).
  const widths = useMemo(() => {
    const t = Math.min(1, Math.max(0, Math.log10(beatHz + 1) / 2));
    const boost = 1 + t * 0.85;
    return {
      channelW: 1.55 * boost,
      backW: 1.35 * boost,
      midW: 1.65 * boost,
      frontW: 2.15 * boost,
    };
  }, [beatHz]);

  return (
    <View style={{width: w, height: h}} pointerEvents="none">
      <Canvas style={{width: w, height: h}} colorSpace="srgb" pointerEvents="none">
        <NeonRadiantPath path={leftPath} strokeValue={leftStroke} strokeWidth={widths.channelW} />
        <NeonRadiantPath path={rightPath} strokeValue={rightStroke} strokeWidth={widths.channelW} />
        <Group>
          <NeonRadiantPath path={backPath} strokeValue={backStroke} strokeWidth={widths.backW} />
          <NeonRadiantPath path={midPath} strokeValue={midStroke} strokeWidth={widths.midW} />
          <NeonRadiantPath path={frontPath} strokeValue={frontStroke} strokeWidth={widths.frontW} />
        </Group>
      </Canvas>
      <Text style={[styles.channelMark, styles.markL, {color: CHANNEL_LEFT}]}>L</Text>
      <Text style={[styles.channelMark, styles.markR, {color: CHANNEL_RIGHT}]}>R</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  channelMark: {
    position: 'absolute',
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  markL: {
    left: 15,
    bottom: 8,
  },
  markR: {
    right: 8,
    top: 14,
  },
});

export const HubOscilloscopeCanvas = memo(HubOscilloscopeCanvasInner);
