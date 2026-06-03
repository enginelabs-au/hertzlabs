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

/**
 * Engine hub oscilloscope — paths rebuilt on the JS thread via rAF.
 * Avoids Skia `usePathValue` → Reanimated mapper chain (crashes at mapper.worklet()).
 */
function HubOscilloscopeCanvasInner({width, height}: HubOscilloscopeCanvasProps) {
  const [timeSec, setTimeSec] = useState(0);
  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);

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
      }),
    [width, height, timeSec, carrierHz, beatHz, phaseAngle, gain, balance],
  );

  const w = Math.max(64, width);
  const h = Math.max(64, height);

  return (
    <Canvas style={{width: w, height: h}} pointerEvents="none">
      <NeonRadiantPath path={paths.top} stroke={STROKE_CYAN} strokeWidth={1.15} />
      <NeonRadiantPath path={paths.left} stroke={STROKE_VIOLET} strokeWidth={1.1} />
      <Group>
        <NeonRadiantPath path={paths.lissajousGlow} stroke={STROKE_VIOLET} strokeWidth={1.05} />
        <NeonRadiantPath path={paths.lissajous} stroke={STROKE_CYAN} strokeWidth={1.2} />
      </Group>
    </Canvas>
  );
}

export const HubOscilloscopeCanvas = memo(HubOscilloscopeCanvasInner);
