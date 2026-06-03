import React, {useMemo} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {Canvas, Path, Vertices, vec} from '@shopify/react-native-skia';
import {GestureDetector} from 'react-native-gesture-handler';
import {channelFrequencies, clampDriftHz} from '../../audio/channelFrequencies';
import type {AudioSurfaceParams} from '../../audio/binauralSurfaceMath';
import {useMathVisualClock} from '../../hooks/useMathVisualClock';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {GlassCard} from '../player/GlassCard';
import {buildMathSurfaceMesh} from './buildMathSurfaceMesh';
import {MathModeAudioWaveStrip} from './MathModeAudioWaveStrip';
import {useMathSurfaceViewport} from './useMathSurfaceViewport';

const WAVE_STRIP_H = 76;
const MESH_FPS = 18;
const WAVE_FPS = 24;

function useMathPlotFrameSize(screenW: number): {plotW: number; plotH: number} {
  const canvasW = screenW - 32;
  const plotH = Math.min(340, Math.max(260, screenW * 0.72));
  const plotW = canvasW - 24;
  return {plotW, plotH};
}

function ColorLegend({height}: {height: number}) {
  const stops = ['1.0', '0.5', '0', '−0.5', '−1.0'];
  return (
    <View style={[styles.legend, {height: height * 0.88}]}>
      {stops.map(label => (
        <Text key={label} style={styles.legendTick}>
          {label}
        </Text>
      ))}
    </View>
  );
}

export function MathMode3DHeader() {
  const {width: screenW} = useWindowDimensions();
  const canvasW = screenW - 32;
  const {plotW, plotH} = useMathPlotFrameSize(screenW);

  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));
  const isPlaying = useHertzStore(s => s.isPlaying);

  const meshTimeSec = useMathVisualClock(MESH_FPS);
  const waveTimeSec = useMathVisualClock(WAVE_FPS);
  const {gesture, viewport} = useMathSurfaceViewport();

  const audio: AudioSurfaceParams = useMemo(
    () => ({
      carrierHz,
      beatHz,
      phaseAngle,
      gain,
      balance,
      leftDriftHz,
      rightDriftHz,
    }),
    [carrierHz, beatHz, phaseAngle, gain, balance, leftDriftHz, rightDriftHz],
  );

  const {leftHz, rightHz} = useMemo(
    () => channelFrequencies(carrierHz, beatHz, leftDriftHz, rightDriftHz),
    [carrierHz, beatHz, leftDriftHz, rightDriftHz],
  );

  const mesh = useMemo(
    () => buildMathSurfaceMesh(plotW, plotH, meshTimeSec, audio, viewport),
    [plotW, plotH, meshTimeSec, audio, viewport],
  );

  const skVertices = useMemo(
    () => mesh.vertices.map(p => vec(p.x, p.y)),
    [mesh.vertices],
  );

  return (
    <GlassCard style={[styles.wrap, {minHeight: plotH + WAVE_STRIP_H + 56}]} padding={0}>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>Z Amp</Text>
        <Text style={styles.axisLabelRight}>
          {leftHz.toFixed(1)} / {rightHz.toFixed(1)} Hz · φ {phaseAngle.toFixed(0)}°
          {isPlaying ? ' · ▶' : ''}
        </Text>
      </View>

      <View style={styles.canvasRow}>
        <ColorLegend height={plotH} />
        <View style={[styles.canvasCenter, {width: plotW, height: plotH}]}>
          <GestureDetector gesture={gesture}>
            <View style={{width: plotW, height: plotH}} collapsable={false}>
              <Canvas style={{width: plotW, height: plotH}} pointerEvents="none">
                <Vertices
                  vertices={skVertices}
                  colors={mesh.colors}
                  indices={mesh.indices}
                  mode="triangles"
                />
                <Path
                  path={mesh.wirePath}
                  color="rgba(255,255,255,0.2)"
                  style="stroke"
                  strokeWidth={0.5}
                />
              </Canvas>
            </View>
          </GestureDetector>
          <Text style={styles.gestureHint}>Drag to orbit depth · pinch to zoom wave</Text>
        </View>
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>Y Amp</Text>
        <Text style={styles.axisLabelRight}>Frequency → · L / R / mix</Text>
      </View>

      <View style={styles.waveStrip}>
        <MathModeAudioWaveStrip width={canvasW} height={WAVE_STRIP_H} timeSec={waveTimeSec} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  axisLabel: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    color: HertzTheme.text.muted,
    letterSpacing: 0.5,
  },
  axisLabelRight: {
    fontFamily: HertzTheme.mono,
    fontSize: 8,
    color: HertzTheme.neon.cyan,
    flexShrink: 1,
    textAlign: 'right',
  },
  canvasRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  canvasCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gestureHint: {
    fontFamily: HertzTheme.mono,
    fontSize: 7,
    color: HertzTheme.text.muted,
    opacity: 0.7,
    marginTop: 4,
    alignSelf: 'center',
  },
  waveStrip: {
    width: '100%',
    overflow: 'hidden',
    paddingBottom: 4,
  },
  legend: {
    width: 22,
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginRight: 4,
    alignSelf: 'stretch',
  },
  legendTick: {
    fontFamily: HertzTheme.mono,
    fontSize: 7,
    color: HertzTheme.text.muted,
    textAlign: 'right',
  },
});
