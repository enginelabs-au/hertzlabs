import React, {useEffect, useMemo, useState} from 'react';
import {Canvas} from '@shopify/react-native-skia';
import {useWindowDimensions} from 'react-native';
import {NeonRadiantPath} from './NeonRadiantPath';
import {STRIP_WAVE_STROKES, type RadiantStrokeStyle} from './radiantWavePalette';
import {buildRadiantWavePathJs} from './skiaWavePath';

const WAVES = [
  {stroke: STRIP_WAVE_STROKES[0], cycles: 2.2, amp: 14, phaseOff: 0},
  {stroke: STRIP_WAVE_STROKES[1], cycles: 2.8, amp: 11, phaseOff: 1.2},
  {stroke: STRIP_WAVE_STROKES[2], cycles: 3.1, amp: 9, phaseOff: 2.4},
] as const;

function StaticWave({
  width,
  centerY,
  amplitude,
  cycles,
  phaseOff,
  stroke,
  timeSec,
}: {
  width: number;
  centerY: number;
  amplitude: number;
  cycles: number;
  phaseOff: number;
  stroke: RadiantStrokeStyle;
  timeSec: number;
}) {
  const path = useMemo(
    () =>
      buildRadiantWavePathJs({
        length: Math.max(8, width),
        amplitude,
        cycles,
        phase: timeSec * 1.4 + phaseOff,
        orientation: 'horizontal',
        center: centerY,
      }),
    [width, centerY, amplitude, cycles, phaseOff, timeSec],
  );
  return <NeonRadiantPath path={path} stroke={stroke} strokeWidth={1.2} />;
}

type RadiantWaveStripProps = {
  height?: number;
  variant?: 'hero' | 'stacked';
};

/** Header wave strip — JS rAF (no Reanimated path mappers). */
export function RadiantWaveStrip({height = 72, variant = 'hero'}: RadiantWaveStripProps) {
  const {width} = useWindowDimensions();
  const [timeSec, setTimeSec] = useState(0);

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

  return (
    <Canvas style={{width, height}} pointerEvents="none">
      {WAVES.map((w, idx) => {
        const cy = variant === 'stacked' ? height * (0.28 + idx * 0.22) : height * 0.55;
        const amp = variant === 'stacked' ? w.amp * 0.65 : w.amp;
        return (
          <StaticWave
            key={idx}
            width={width}
            centerY={cy}
            amplitude={amp}
            cycles={w.cycles}
            phaseOff={w.phaseOff}
            stroke={w.stroke}
            timeSec={timeSec}
          />
        );
      })}
    </Canvas>
  );
}
