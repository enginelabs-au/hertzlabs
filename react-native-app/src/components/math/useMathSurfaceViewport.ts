import {useCallback, useRef, useState} from 'react';
import {Gesture} from 'react-native-gesture-handler';
import {runOnJS, useSharedValue} from 'react-native-reanimated';
import {DEFAULT_MATH_MESH_SCALE, type MathViewport} from './buildMathSurfaceMesh';

export type {MathViewport};

const MIN_MESH_SCALE = 1.1;
const MAX_MESH_SCALE = 2.6;
const MAX_PITCH = 0.32;
const YAW_PER_PX = 0.0022;
const PITCH_PER_PX = 0.0016;
/** Two-finger twist → orbit around vertical (depth), not screen spin. */
const TWIST_TO_YAW = 0.38;

function clamp(n: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Orbit the 3D pond in depth (yaw / pitch on the isometric projection).
 * Pinch adjusts mesh scale inside the plot frame — no 2D canvas rotation.
 */
export function useMathSurfaceViewport() {
  const yaw = useSharedValue(0);
  const pitch = useSharedValue(0);
  const meshScale = useSharedValue(DEFAULT_MATH_MESH_SCALE);
  const savedYaw = useSharedValue(0);
  const savedPitch = useSharedValue(0);
  const savedScale = useSharedValue(DEFAULT_MATH_MESH_SCALE);

  const [viewport, setViewport] = useState<MathViewport>({
    yawOffset: 0,
    pitchOffset: 0,
    meshScale: DEFAULT_MATH_MESH_SCALE,
  });

  const lastPushMs = useRef(0);

  const pushViewport = useCallback((y: number, p: number, s: number, force = false) => {
    const now = Date.now();
    if (!force && now - lastPushMs.current < 90) {
      return;
    }
    lastPushMs.current = now;
    setViewport({
      yawOffset: y,
      pitchOffset: p,
      meshScale: s,
    });
  }, []);

  const sync = (force: boolean) => {
    'worklet';
    runOnJS(pushViewport)(yaw.value, pitch.value, meshScale.value, force);
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = meshScale.value;
    })
    .onUpdate(e => {
      meshScale.value = clamp(savedScale.value * e.scale, MIN_MESH_SCALE, MAX_MESH_SCALE);
      sync(false);
    })
    .onEnd(() => sync(true));

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      savedYaw.value = yaw.value;
    })
    .onUpdate(e => {
      yaw.value = savedYaw.value + e.rotation * TWIST_TO_YAW;
      sync(false);
    })
    .onEnd(() => sync(true));

  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      savedYaw.value = yaw.value;
      savedPitch.value = pitch.value;
    })
    .onUpdate(e => {
      yaw.value = savedYaw.value + e.translationX * YAW_PER_PX;
      pitch.value = clamp(
        savedPitch.value - e.translationY * PITCH_PER_PX,
        -MAX_PITCH,
        MAX_PITCH,
      );
      sync(false);
    })
    .onEnd(() => sync(true));

  const gesture = Gesture.Simultaneous(pinch, rotate, pan);

  return {gesture, viewport};
}
