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
import {NeonRadiantPath} from './NeonRadiantPath';

const CHANNEL_LEFT = HertzTheme.channel.left;
const CHANNEL_RIGHT = HertzTheme.channel.right;

type HubOscilloscopeCanvasProps = {
  width: number;
  height: number;
  /** Live UI-thread audio params — paths follow these every frame (slider + dial). */
  dialValues: DialValues;
  leftDriftHz: number;
  rightDriftHz: number;
  /** Band hue + intensity inputs (store-backed; update on commit). */
  bandHex: string;
  beatHz: number;
  gain: number;
};

/**
 * Hub oscilloscope — paths rebuilt on the UI thread each frame from `dialValues`
 * shared values, so the waveform follows the beat slider / dial live (no JS bridge
 * traffic during drag). Mirrors LissajousCanvas / FramedBorderWaves.
 */
function HubOscilloscopeCanvasInner({
  width,
  height,
  dialValues,
  leftDriftHz,
  rightDriftHz,
  bandHex,
  beatHz,
  gain,
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

  const styles_pack = useMemo(() => {
    const gainPart = Math.min(1, Math.max(0.4, gain * 1.2));
    const beatPart = Math.min(1, Math.max(0.45, Math.log10(beatHz + 1) / 1.55));
    const intensity = Math.min(1, gainPart * (0.65 + beatPart * 0.55));
    const chIntensity = Math.min(1, intensity * 1.05);
    const t = Math.min(1, Math.max(0, Math.log10(beatHz + 1) / 2));
    const boost = 1 + t * 0.85;
    return {
      left: bandStrokeFromHex(CHANNEL_LEFT, chIntensity),
      right: bandStrokeFromHex(CHANNEL_RIGHT, chIntensity),
      back: bandStrokeFromHex(bandHex, intensity * 0.48),
      mid: bandStrokeFromHex(bandHex, intensity * 0.72),
      front: bandStrokeFromHex(bandHex, intensity),
      channelW: 1.55 * boost,
      backW: 1.35 * boost,
      midW: 1.65 * boost,
      frontW: 2.15 * boost,
    };
  }, [bandHex, beatHz, gain]);

  return (
    <View style={{width: w, height: h}} pointerEvents="none">
      <Canvas style={{width: w, height: h}} colorSpace="srgb" pointerEvents="none">
        <NeonRadiantPath path={leftPath} stroke={styles_pack.left} strokeWidth={styles_pack.channelW} />
        <NeonRadiantPath path={rightPath} stroke={styles_pack.right} strokeWidth={styles_pack.channelW} />
        <Group>
          <NeonRadiantPath path={backPath} stroke={styles_pack.back} strokeWidth={styles_pack.backW} />
          <NeonRadiantPath path={midPath} stroke={styles_pack.mid} strokeWidth={styles_pack.midW} />
          <NeonRadiantPath path={frontPath} stroke={styles_pack.front} strokeWidth={styles_pack.frontW} />
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
    left: 8,
    bottom: 8,
  },
  markR: {
    right: 8,
    top: 6,
  },
});

export const HubOscilloscopeCanvas = memo(HubOscilloscopeCanvasInner);
