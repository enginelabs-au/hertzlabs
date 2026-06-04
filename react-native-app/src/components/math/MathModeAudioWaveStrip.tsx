import React, {useEffect, useMemo} from 'react';
import {Canvas, useCanvasRef} from '@shopify/react-native-skia';
import {clampDriftHz} from '../../audio/channelFrequencies';
import {useHertzStore} from '../../state/store';
import {NeonRadiantPath} from '../waveforms/NeonRadiantPath';
import {STROKE_CYAN, STROKE_TEAL, STROKE_VIOLET} from '../waveforms/radiantWavePalette';
import {buildMathWaveStripPaths} from './mathModeWavePaths';

type MathModeAudioWaveStripProps = {
  width: number;
  height: number;
  timeSec: number;
};

export function MathModeAudioWaveStrip({width, height, timeSec}: MathModeAudioWaveStripProps) {
  const canvasRef = useCanvasRef();
  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));

  const paths = useMemo(
    () =>
      buildMathWaveStripPaths(width, height, timeSec, {
        carrierHz,
        beatHz,
        phaseAngle,
        gain,
        balance,
        leftDriftHz,
        rightDriftHz,
      }),
    [
      width,
      height,
      timeSec,
      carrierHz,
      beatHz,
      phaseAngle,
      gain,
      balance,
      leftDriftHz,
      rightDriftHz,
    ],
  );

  useEffect(() => {
    canvasRef.current?.redraw();
  }, [paths, canvasRef]);

  return (
    <Canvas ref={canvasRef} style={{width, height}} colorSpace="srgb" pointerEvents="none">
      <NeonRadiantPath path={paths.left} stroke={STROKE_CYAN} strokeWidth={1.25} />
      <NeonRadiantPath path={paths.right} stroke={STROKE_VIOLET} strokeWidth={1.2} />
      <NeonRadiantPath path={paths.mix} stroke={STROKE_TEAL} strokeWidth={1.15} />
    </Canvas>
  );
}
