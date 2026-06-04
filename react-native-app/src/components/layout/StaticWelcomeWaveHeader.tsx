import React, {useEffect, useMemo} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {Canvas, useCanvasRef} from '@shopify/react-native-skia';
import {GlassCard} from '../player/GlassCard';
import {HertzTheme} from '../../theme/hertzTheme';
import {NeonRadiantPath} from '../waveforms/NeonRadiantPath';
import {STRIP_WAVE_STROKES} from '../waveforms/radiantWavePalette';
import {buildRadiantWavePathJs} from '../waveforms/skiaWavePath';

const STATIC_WAVES = [
  {stroke: STRIP_WAVE_STROKES[0], cycles: 2.2, amp: 14, phaseOff: 0},
  {stroke: STRIP_WAVE_STROKES[1], cycles: 2.8, amp: 11, phaseOff: 1.2},
  {stroke: STRIP_WAVE_STROKES[2], cycles: 3.1, amp: 9, phaseOff: 2.4},
] as const;

/**
 * Non-animated wave header for onboarding — same gentle neon layers as main app.
 */
export function StaticWelcomeWaveHeader({height = 72}: {height?: number}) {
  const {width} = useWindowDimensions();
  const canvasW = width - 32;
  const canvasRef = useCanvasRef();

  const layers = useMemo(() => {
    return STATIC_WAVES.map((w, idx) => {
      const cy = height * (0.28 + idx * 0.22);
      return {
        path: buildRadiantWavePathJs({
          length: canvasW,
          amplitude: w.amp * 0.65,
          cycles: w.cycles,
          phase: w.phaseOff,
          orientation: 'horizontal' as const,
          center: cy,
        }),
        stroke: w.stroke,
      };
    });
  }, [canvasW, height]);

  useEffect(() => {
    canvasRef.current?.redraw();
  }, [layers, canvasRef]);

  return (
    <GlassCard style={styles.wrap} padding={0}>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>Y Amp</Text>
        <Text style={styles.axisLabelRight}>Frequency →</Text>
      </View>
      <Canvas
        ref={canvasRef}
        style={{width: canvasW, height, alignSelf: 'center'}}
        colorSpace="srgb"
        pointerEvents="none">
        {layers.map((layer, i) => (
          <NeonRadiantPath key={i} path={layer.path} stroke={layer.stroke} strokeWidth={1.2} />
        ))}
      </Canvas>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 72,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  axisLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
    letterSpacing: 0.5,
  },
  axisLabelRight: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
  },
});
