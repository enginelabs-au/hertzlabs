import React, {useEffect, useMemo} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {Canvas, Circle, Line, Path, Skia, useCanvasRef} from '@shopify/react-native-skia';
import {GestureDetector} from 'react-native-gesture-handler';
import {clampDriftHz, channelFrequencies} from '../../audio/channelFrequencies';
import {useMathVisualClock} from '../../hooks/useMathVisualClock';
import {useHertzStore} from '../../state/store';
import {HertzTheme} from '../../theme/hertzTheme';
import {GlassCard} from '../player/GlassCard';
import {buildDopplerGrid, buildDopplerRings, type DopplerFieldParams} from './dopplerFieldMath';
import {useDopplerSourceDrag} from './useDopplerSourceDrag';

const FIELD_H = 300;
const FIELD_FPS = 24;
const GRID_COLOR = 'rgba(255,255,255,0.06)';

function ringsToDrawables(rings: ReturnType<typeof buildDopplerRings>) {
  return rings.map(ring => {
    const b = Skia.PathBuilder.Make();
    ring.points.forEach((p, i) => {
      if (i === 0) {
        b.moveTo(p.x, p.y);
      } else {
        b.lineTo(p.x, p.y);
      }
    });
    b.close();
    return {path: b.build(), color: ring.color, strokeWidth: ring.strokeWidth};
  });
}

export function BackgroundDopplerField() {
  const {width: screenW} = useWindowDimensions();
  const plotW = screenW - 32;
  const plotH = FIELD_H;

  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));
  const isPlaying = useHertzStore(s => s.isPlaying);

  const timeSec = useMathVisualClock(FIELD_FPS);
  const {gesture, sourceX, sourceY} = useDopplerSourceDrag({plotW, plotH});

  const params: DopplerFieldParams = useMemo(
    () => ({
      carrierHz,
      beatHz,
      phaseAngle,
      gain,
      balance,
      leftDriftHz,
      rightDriftHz,
      timeSec,
      sourceX,
      sourceY,
    }),
    [
      carrierHz,
      beatHz,
      phaseAngle,
      gain,
      balance,
      leftDriftHz,
      rightDriftHz,
      timeSec,
      sourceX,
      sourceY,
    ],
  );

  const {leftHz, rightHz} = useMemo(
    () => channelFrequencies(carrierHz, beatHz, leftDriftHz, rightDriftHz),
    [carrierHz, beatHz, leftDriftHz, rightDriftHz],
  );

  const rings = useMemo(() => buildDopplerRings(plotW, plotH, params), [plotW, plotH, params]);
  const drawables = useMemo(() => ringsToDrawables(rings), [rings]);
  const grid = useMemo(() => buildDopplerGrid(plotW, plotH), [plotW, plotH]);

  const handleR = 14;
  const canvasRef = useCanvasRef();

  useEffect(() => {
    canvasRef.current?.redraw();
  }, [drawables, grid, canvasRef]);

  return (
    <GlassCard style={styles.wrap} padding={0}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>DOPPLER SPATIALIZATION</Text>
        <Text style={styles.spotifyTag}>SPOTIFY MIX</Text>
      </View>

      <View style={styles.hintRow}>
        <Text style={styles.hint}>↔ TARGET Δ (Hz) · ↕ PHASE · depth = GAIN</Text>
      </View>

      <View style={[styles.plotBox, {width: plotW, height: plotH}]}>
        <Canvas ref={canvasRef} style={{width: plotW, height: plotH}} colorSpace="srgb" pointerEvents="none">
          {grid.vertical.map((ln, i) => (
            <Line
              key={`v${i}`}
              p1={{x: ln.x1, y: ln.y1}}
              p2={{x: ln.x2, y: ln.y2}}
              color={GRID_COLOR}
              strokeWidth={0.5}
            />
          ))}
          {grid.horizontal.map((ln, i) => (
            <Line
              key={`h${i}`}
              p1={{x: ln.x1, y: ln.y1}}
              p2={{x: ln.x2, y: ln.y2}}
              color={GRID_COLOR}
              strokeWidth={0.5}
            />
          ))}
          {drawables.map((d, i) => (
            <Path
              key={`r${i}`}
              path={d.path}
              color={d.color}
              style="stroke"
              strokeWidth={d.strokeWidth}
            />
          ))}
        </Canvas>

        <GestureDetector gesture={gesture}>
          <View
            style={[
              styles.handleHit,
              {
                left: sourceX - handleR,
                top: sourceY - handleR,
                width: handleR * 2,
                height: handleR * 2,
              },
            ]}
            collapsable={false}>
            <View style={styles.handleOuter}>
              <View style={styles.handleInner} />
            </View>
          </View>
        </GestureDetector>

        <View style={styles.readout} pointerEvents="none">
          <Text style={styles.readoutLine}>
            C: {carrierHz.toFixed(1)} · Δ: {beatHz.toFixed(2)} Hz
          </Text>
          <Text style={styles.readoutLine}>
            φ: {phaseAngle.toFixed(0)}° · G: {(gain * 100).toFixed(0)}%
          </Text>
          <Text style={styles.readoutLine}>
            L: {leftHz.toFixed(1)} · R: {rightHz.toFixed(1)}
          </Text>
          {isPlaying ? <Text style={styles.readoutLive}>● LIVE</Text> : null}
        </View>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    letterSpacing: 1.2,
  },
  spotifyTag: {
    fontFamily: HertzTheme.mono,
    fontSize: 9,
    fontWeight: '700',
    color: HertzTheme.neon.green,
    letterSpacing: 0.8,
  },
  hintRow: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  hint: {
    fontFamily: HertzTheme.mono,
    fontSize: 7,
    color: HertzTheme.text.muted,
    letterSpacing: 0.3,
  },
  plotBox: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  handleHit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  handleOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  handleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: HertzTheme.neon.green,
  },
  readout: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    gap: 2,
  },
  readoutLine: {
    fontFamily: HertzTheme.mono,
    fontSize: 7,
    color: 'rgba(255,255,255,0.65)',
  },
  readoutLive: {
    fontFamily: HertzTheme.mono,
    fontSize: 6,
    color: HertzTheme.neon.lime,
    marginTop: 2,
  },
});
