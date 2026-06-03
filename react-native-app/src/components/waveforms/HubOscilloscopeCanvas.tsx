import React, {memo, useEffect, useMemo, useState} from 'react';
import {Canvas, Group} from '@shopify/react-native-skia';
import {useHertzStore} from '../../state/store';
import {NeonRadiantPath} from './NeonRadiantPath';
import {STROKE_CYAN, STROKE_VIOLET} from './radiantWavePalette';
import {buildHubScopePaths} from './hubPathBuilders';
import type {DialValues} from '../CircularController/useDialSharedValues';

type HubOscilloscopeCanvasProps = {
  width: number;
  height: number;
  /** Kept for gesture wiring; audio params read from store each frame on JS thread. */
  dialValues: DialValues;
};

const STROKE_BACK = {
  core: 'rgba(167,139,250,0.35)',
  glow: 'rgba(167,139,250,0.2)',
  halo: 'rgba(167,139,250,0.08)',
};

const STROKE_MID = {
  core: 'rgba(92,225,255,0.55)',
  glow: 'rgba(92,225,255,0.35)',
  halo: 'rgba(92,225,255,0.12)',
};

/**
 * Engine hub oscilloscope — paths rebuilt on the JS thread via rAF.
 * Center: pseudo-3D Lissajous (phase rotates depth); borders: L/R traces.
 */
function HubOscilloscopeCanvasInner({width, height}: HubOscilloscopeCanvasProps) {
  const [timeSec, setTimeSec] = useState(0);
  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);
  const leftDriftHz = useHertzStore(s => s.leftDriftHz);
  const rightDriftHz = useHertzStore(s => s.rightDriftHz);

  useEffect(() => {
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      setTimeSec((Date.now() - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const paths = useMemo(
    () =>
      buildHubScopePaths(width, height, timeSec, {
        carrierHz,
        beatHz,
        phaseAngle,
        gain,
        balance,
        leftDriftHz,
        rightDriftHz,
      }),
    [width, height, timeSec, carrierHz, beatHz, phaseAngle, gain, balance, leftDriftHz, rightDriftHz],
  );

  const w = Math.max(64, width);
  const h = Math.max(64, height);

  return (
    <Canvas style={{width: w, height: h}} pointerEvents="none">
      <NeonRadiantPath path={paths.top} stroke={STROKE_CYAN} strokeWidth={1.35} />
      <NeonRadiantPath path={paths.left} stroke={STROKE_VIOLET} strokeWidth={1.3} />
      <Group>
        <NeonRadiantPath path={paths.lissajousBack} stroke={STROKE_BACK} strokeWidth={1.1} />
        <NeonRadiantPath path={paths.lissajousMid} stroke={STROKE_MID} strokeWidth={1.25} />
        <NeonRadiantPath path={paths.lissajousFront} stroke={STROKE_CYAN} strokeWidth={1.55} />
      </Group>
    </Canvas>
  );
}

export const HubOscilloscopeCanvas = memo(HubOscilloscopeCanvasInner);
