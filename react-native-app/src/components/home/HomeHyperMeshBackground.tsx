import React, {useMemo} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {Canvas, Path, Vertices} from '@shopify/react-native-skia';
import {clampDriftHz} from '../../audio/channelFrequencies';
import type {AudioSurfaceParams} from '../math/mathRippleSurface';
import {useMathVisualClock} from '../../hooks/useMathVisualClock';
import {useHertzStore} from '../../state/store';
import {buildMathSurfaceMesh} from '../math/buildMathSurfaceMesh';

const MESH_FPS = 18;

/** Clean full-viewport topographic mesh — no formulas, labels, or edge strips. */
export function HomeHyperMeshBackground() {
  const {width, height} = useWindowDimensions();
  const carrierHz = useHertzStore(s => s.carrierHz);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const gain = useHertzStore(s => s.gain);
  const balance = useHertzStore(s => s.balance);
  const leftDriftHz = clampDriftHz(useHertzStore(s => s.leftDriftHz));
  const rightDriftHz = clampDriftHz(useHertzStore(s => s.rightDriftHz));

  const meshTimeSec = useMathVisualClock(MESH_FPS);

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

  const mesh = useMemo(
    () =>
      buildMathSurfaceMesh(width, height, meshTimeSec, audio, {
        yawOffset: meshTimeSec * 0.06,
        pitchOffset: 0.32,
        meshScale: 2.05,
      }),
    [width, height, meshTimeSec, audio],
  );

  const skVertices = useMemo(
    () => ({
      vertices: mesh.vertices,
      colors: mesh.colors,
      indices: mesh.indices,
    }),
    [mesh],
  );

  return (
    <View style={styles.root} pointerEvents="none">
      <Canvas style={{width, height}}>
        <Vertices vertices={skVertices.vertices} colors={skVertices.colors} indices={skVertices.indices} />
        <Path path={mesh.wirePath} style="stroke" strokeWidth={0.5} color="rgba(92,225,255,0.12)" />
      </Canvas>
      <View style={styles.scrim} />
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,10,18,0.52)',
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(8,10,18,0.65)',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(8,10,18,0.55)',
  },
});
