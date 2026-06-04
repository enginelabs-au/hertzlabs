import React, {useEffect, useMemo, useState} from 'react';
import {Canvas, useCanvasRef} from '@shopify/react-native-skia';
import {useWindowDimensions} from 'react-native';
import {NeonRadiantPath} from './NeonRadiantPath';
import {STRIP_WAVE_STROKES, type RadiantStrokeStyle} from './radiantWavePalette';
import {buildRadiantWavePathJs} from './skiaWavePath';

const WAVES = [
  {stroke: STRIP_WAVE_STROKES[0], cyclesMul: 1, amp: 14, phaseOff: 0},
  {stroke: STRIP_WAVE_STROKES[1], cyclesMul: 1.28, amp: 11, phaseOff: 1.2},
  {stroke: STRIP_WAVE_STROKES[2], cyclesMul: 1.42, amp: 9, phaseOff: 2.4},
] as const;

function StaticWave({
  width,
  centerY,
  amplitude,
  cycles,
  phaseOff,
  stroke,
  phase,
}: {
  width: number;
  centerY: number;
  amplitude: number;
  cycles: number;
  phaseOff: number;
  stroke: RadiantStrokeStyle;
  phase: number;
}) {
  const path = useMemo(
    () =>
      buildRadiantWavePathJs({
        length: Math.max(8, width),
        amplitude,
        cycles,
        phase: phase + phaseOff,
        orientation: 'horizontal',
        center: centerY,
      }),
    [width, centerY, amplitude, cycles, phaseOff, phase],
  );
  return <NeonRadiantPath path={path} stroke={stroke} strokeWidth={1.2} />;
}

type RadiantWaveStripProps = {
  height?: number;
  variant?: 'hero' | 'stacked';
  /** Shared clock (e.g. from Math 3D header) — always animates when provided. */
  timeSec?: number;
  /** Beat Hz drives scroll speed and wavelength. */
  beatHz?: number;
  /** Canvas width when not full screen. */
  canvasWidth?: number;
};

/** Header wave strip — JS rAF, or parent-driven time for sync with 3D surface. */
export function RadiantWaveStrip({
  height = 72,
  variant = 'stacked',
  timeSec: externalTime,
  beatHz = 10,
  canvasWidth,
}: RadiantWaveStripProps) {
  const {width: screenW} = useWindowDimensions();
  const width = canvasWidth ?? screenW;
  const [internalTime, setInternalTime] = useState(0);

  useEffect(() => {
    if (externalTime != null) {
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      setInternalTime((Date.now() - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [externalTime]);

  const timeSec = externalTime ?? internalTime;
  const phase = timeSec * (1.15 + Math.min(beatHz, 40) * 0.085);
  const cycleScale = 1.6 + Math.sqrt(Math.max(0.05, beatHz)) * 0.35;
  const canvasRef = useCanvasRef();

  useEffect(() => {
    canvasRef.current?.redraw();
  }, [phase, cycleScale, width, height, variant, canvasRef]);

  return (
    <Canvas ref={canvasRef} style={{width, height}} colorSpace="srgb" pointerEvents="none">
      {WAVES.map((w, idx) => {
        const cy = variant === 'stacked' ? height * (0.28 + idx * 0.22) : height * 0.55;
        const amp = variant === 'stacked' ? w.amp * 0.65 : w.amp;
        return (
          <StaticWave
            key={idx}
            width={width}
            centerY={cy}
            amplitude={amp}
            cycles={w.cyclesMul * cycleScale}
            phaseOff={w.phaseOff}
            stroke={w.stroke}
            phase={phase}
          />
        );
      })}
    </Canvas>
  );
}
