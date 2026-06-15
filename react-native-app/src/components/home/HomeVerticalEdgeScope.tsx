import React, {memo} from 'react';
import {Canvas} from '@shopify/react-native-skia';
import {Skia} from '@shopify/react-native-skia';
import {useDerivedValue, useFrameCallback, useSharedValue} from 'react-native-reanimated';
import {scopeStereoHz} from '../../audio/channelFrequencies';
import {appendOscilloscopeTrace} from '../../audio/oscilloscopeMath';
import {bandStrokeFromHex} from '../waveforms/bandStrokeColors';
import {NeonRadiantPath} from '../waveforms/NeonRadiantPath';
import {HertzTheme} from '../../theme/hertzTheme';

type HomeVerticalEdgeScopeProps = {
  side: 'left' | 'right';
  width: number;
  height: number;
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
  gain: number;
  leftDriftHz: number;
  rightDriftHz: number;
  deep?: boolean;
};

function HomeVerticalEdgeScopeInner({
  side,
  width,
  height,
  carrierHz,
  beatHz,
  phaseAngle,
  gain,
  leftDriftHz,
  rightDriftHz,
  deep = false,
}: HomeVerticalEdgeScopeProps) {
  const time = useSharedValue(0);
  useFrameCallback(
    frame => {
      'worklet';
      time.value = frame.timestamp / 1000;
    },
    true,
  );

  const channelHex = side === 'left' ? HertzTheme.channel.left : HertzTheme.channel.right;
  const ampMul = deep ? 0.78 : 0.38;
  const strokeW = deep ? 2.6 : 1.65;

  const path = useDerivedValue(() => {
    'worklet';
    const {leftHz, rightHz} = scopeStereoHz(carrierHz, beatHz, leftDriftHz, rightDriftHz);
    const hz = side === 'left' ? leftHz : rightHz;
    const phaseRad = side === 'right' ? (phaseAngle * Math.PI) / 180 : 0;
    const b = Skia.PathBuilder.Make();
    appendOscilloscopeTrace(b, {
      length: height,
      center: width * 0.5,
      amplitude: width * ampMul,
      hz,
      timeSec: time.value,
      orientation: 'vertical',
      phaseRad,
      gain,
      maxSteps: deep ? 88 : 72,
      traceSpanMul: deep ? 1.65 : 1.45,
    });
    return b.build();
  }, [side, width, height, carrierHz, beatHz, phaseAngle, gain, leftDriftHz, rightDriftHz, deep, ampMul]);

  const stroke = useDerivedValue(() => {
    'worklet';
    const intensity = Math.min(1, Math.max(0.45, gain * 1.15));
    return bandStrokeFromHex(channelHex, intensity);
  }, [channelHex, gain]);

  return (
    <Canvas style={{width, height}} pointerEvents="none">
      <NeonRadiantPath path={path} strokeValue={stroke} strokeWidth={strokeW} />
    </Canvas>
  );
}

export const HomeVerticalEdgeScope = memo(HomeVerticalEdgeScopeInner);
