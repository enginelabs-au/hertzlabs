import React, {memo} from 'react';
import {Canvas, Path, Skia} from '@shopify/react-native-skia';
import {useDerivedValue, useFrameCallback, useSharedValue} from 'react-native-reanimated';
import {scopeStereoHz} from '../../audio/channelFrequencies';
import {appendOscilloscopeTrace} from '../../audio/oscilloscopeMath';
import {getBand} from '../ReadoutPanel/brainwaveBands';
import {bandStrokeFromHex} from '../waveforms/bandStrokeColors';
import {NeonRadiantPath} from '../waveforms/NeonRadiantPath';

type HomeOscilloscopeBackdropProps = {
  width: number;
  height: number;
  carrierHz: number;
  beatHz: number;
  phaseAngle: number;
  gain: number;
  balance: number;
  leftDriftHz: number;
  rightDriftHz: number;
};

const LANES = [0.22, 0.42, 0.62, 0.78] as const;

function buildLanePath(
  width: number,
  height: number,
  lane: number,
  laneIdx: number,
  timeSec: number,
  carrierHz: number,
  beatHz: number,
  phaseAngle: number,
  gain: number,
  leftDriftHz: number,
  rightDriftHz: number,
) {
  'worklet';
  const {leftHz, rightHz} = scopeStereoHz(carrierHz, beatHz, leftDriftHz, rightDriftHz);
  const hz = laneIdx % 2 === 0 ? leftHz : rightHz;
  const phaseRad = laneIdx % 2 === 0 ? 0 : (phaseAngle * Math.PI) / 180;
  const b = Skia.PathBuilder.Make();
  appendOscilloscopeTrace(b, {
    length: width,
    center: height * lane,
    amplitude: height * 0.042,
    hz,
    timeSec,
    orientation: 'horizontal',
    phaseRad,
    gain,
    maxSteps: 64,
    traceSpanMul: 1.5,
  });
  return b.build();
}

function HomeOscilloscopeBackdropInner({
  width,
  height,
  carrierHz,
  beatHz,
  phaseAngle,
  gain,
  leftDriftHz,
  rightDriftHz,
}: HomeOscilloscopeBackdropProps) {
  const time = useSharedValue(0);
  useFrameCallback(
    frame => {
      'worklet';
      time.value = frame.timestamp / 1000;
    },
    true,
  );

  const bandHex = getBand(beatHz).hexColor;

  const path0 = useDerivedValue(() =>
    buildLanePath(width, height, LANES[0], 0, time.value, carrierHz, beatHz, phaseAngle, gain, leftDriftHz, rightDriftHz),
  );
  const path1 = useDerivedValue(() =>
    buildLanePath(width, height, LANES[1], 1, time.value, carrierHz, beatHz, phaseAngle, gain, leftDriftHz, rightDriftHz),
  );
  const path2 = useDerivedValue(() =>
    buildLanePath(width, height, LANES[2], 2, time.value, carrierHz, beatHz, phaseAngle, gain, leftDriftHz, rightDriftHz),
  );
  const path3 = useDerivedValue(() =>
    buildLanePath(width, height, LANES[3], 3, time.value, carrierHz, beatHz, phaseAngle, gain, leftDriftHz, rightDriftHz),
  );

  const stroke = useDerivedValue(() => {
    'worklet';
    const intensity = Math.min(1, Math.max(0.3, gain * 0.95));
    return bandStrokeFromHex(bandHex, intensity * 0.5);
  }, [bandHex, gain]);

  return (
    <Canvas style={{width, height}} pointerEvents="none">
      <NeonRadiantPath path={path0} strokeValue={stroke} strokeWidth={1.05} />
      <NeonRadiantPath path={path1} strokeValue={stroke} strokeWidth={1.05} />
      <NeonRadiantPath path={path2} strokeValue={stroke} strokeWidth={1.05} />
      <NeonRadiantPath path={path3} strokeValue={stroke} strokeWidth={1.05} />
    </Canvas>
  );
}

export const HomeOscilloscopeBackdrop = memo(HomeOscilloscopeBackdropInner);
