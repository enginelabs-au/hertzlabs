import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Gesture} from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import type {SubscriptionTier} from '../../state/types';
import {useHertzStore} from '../../state/store';
import {
  beatPhaseToSourcePx,
  dominantAxis,
  sourcePxToAudioParams,
} from './dopplerSourceMapping';

type UseDopplerSourceDragOpts = {
  plotW: number;
  plotH: number;
};

const AUDIO_COMMIT_MS = 48;

/**
 * Draggable Doppler emitter — handle moves on the UI thread; audio params commit
 * on a throttled JS schedule so the matrix does not stutter or snap back.
 */
export function useDopplerSourceDrag({plotW, plotH}: UseDopplerSourceDragOpts) {
  const tier = useHertzStore(s => s.tier);
  const beatSliderScale = useHertzStore(s => s.beatSliderScale);
  const beatHz = useHertzStore(s => s.beatHz);
  const phaseAngle = useHertzStore(s => s.phaseAngle);
  const setParam = useHertzStore(s => s.setParam);

  const plotWRef = useRef(plotW);
  const plotHRef = useRef(plotH);
  plotWRef.current = plotW;
  plotHRef.current = plotH;

  const plotWSV = useSharedValue(plotW);
  const plotHSV = useSharedValue(plotH);
  useEffect(() => {
    plotWSV.value = plotW;
    plotHSV.value = plotH;
  }, [plotW, plotH, plotWSV, plotHSV]);

  const tierRef = useRef(tier);
  tierRef.current = tier;
  const scaleRef = useRef(beatSliderScale);
  scaleRef.current = beatSliderScale;

  const anchor = useMemo(
    () => beatPhaseToSourcePx(plotW, plotH, beatHz, phaseAngle, tier, beatSliderScale),
    [plotW, plotH, beatHz, phaseAngle, tier, beatSliderScale],
  );

  const sourceX = useSharedValue(anchor.cx);
  const sourceY = useSharedValue(anchor.cy);
  const dragging = useSharedValue(false);
  const originX = useSharedValue(anchor.cx);
  const originY = useSharedValue(anchor.cy);

  useEffect(() => {
    if (!dragging.value) {
      sourceX.value = anchor.cx;
      sourceY.value = anchor.cy;
    }
  }, [anchor.cx, anchor.cy, dragging, sourceX, sourceY]);

  const lastCommitMs = useRef(0);

  const commitFromPx = useCallback(
    (cx: number, cy: number, axis: 'x' | 'y' | 'both', force: boolean) => {
      const now = Date.now();
      if (!force && now - lastCommitMs.current < AUDIO_COMMIT_MS) {
        return;
      }
      lastCommitMs.current = now;

      const w = plotWRef.current;
      const h = plotHRef.current;
      const updates = sourcePxToAudioParams(
        cx,
        cy,
        w,
        h,
        tierRef.current as SubscriptionTier,
        axis,
        scaleRef.current,
      );

      if (updates.beatHz != null && Number.isFinite(updates.beatHz)) {
        setParam('beatHz', updates.beatHz);
      }
      if (updates.phaseAngle != null && Number.isFinite(updates.phaseAngle)) {
        setParam('phaseAngle', updates.phaseAngle);
      }
      if (updates.gain != null && Number.isFinite(updates.gain)) {
        setParam('gain', updates.gain);
      }
    },
    [setParam],
  );

  const commitDragEnd = useCallback(
    (cx: number, cy: number) => {
      commitFromPx(cx, cy, 'both', true);
    },
    [commitFromPx],
  );

  const commitDragMove = useCallback(
    (cx: number, cy: number, translationX: number, translationY: number) => {
      const axis = dominantAxis(translationX, translationY);
      commitFromPx(cx, cy, axis, false);
    },
    [commitFromPx],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .onBegin(() => {
          'worklet';
          dragging.value = true;
          originX.value = sourceX.value;
          originY.value = sourceY.value;
        })
        .onUpdate(e => {
          'worklet';
          const w = plotWSV.value;
          const h = plotHSV.value;
          const cx = Math.min(w - 12, Math.max(12, originX.value + e.translationX));
          const cy = Math.min(h - 12, Math.max(12, originY.value + e.translationY));
          sourceX.value = cx;
          sourceY.value = cy;
          runOnJS(commitDragMove)(cx, cy, e.translationX, e.translationY);
        })
        .onEnd(e => {
          'worklet';
          const w = plotWSV.value;
          const h = plotHSV.value;
          const cx = Math.min(w - 12, Math.max(12, originX.value + e.translationX));
          const cy = Math.min(h - 12, Math.max(12, originY.value + e.translationY));
          sourceX.value = cx;
          sourceY.value = cy;
          dragging.value = false;
          runOnJS(commitDragEnd)(cx, cy);
        })
        .onFinalize(() => {
          'worklet';
          dragging.value = false;
        }),
    [
      commitDragEnd,
      commitDragMove,
      dragging,
      originX,
      originY,
      plotHSV,
      plotWSV,
      sourceX,
      sourceY,
    ],
  );

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{translateX: sourceX.value - 14}, {translateY: sourceY.value - 14}],
  }));

  return {gesture, sourceX, sourceY, handleStyle};
}

/** Mirror UI-thread drag position for Skia ring rebuilds (~20 Hz). */
export function useDopplerSourceMirror(
  sourceX: SharedValue<number>,
  sourceY: SharedValue<number>,
  fallbackX: number,
  fallbackY: number,
): {mirrorX: number; mirrorY: number} {
  const [mirrorX, setMirrorX] = useState(fallbackX);
  const [mirrorY, setMirrorY] = useState(fallbackY);
  const lastMirrorMs = useRef(0);

  useEffect(() => {
    setMirrorX(fallbackX);
    setMirrorY(fallbackY);
  }, [fallbackX, fallbackY]);

  const maybeSetMirror = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastMirrorMs.current < 50) {
      return;
    }
    lastMirrorMs.current = now;
    setMirrorX(x);
    setMirrorY(y);
  }, []);

  useAnimatedReaction(
    () => ({x: sourceX.value, y: sourceY.value}),
    (curr, prev) => {
      if (prev == null || curr.x !== prev.x || curr.y !== prev.y) {
        runOnJS(maybeSetMirror)(curr.x, curr.y);
      }
    },
    [maybeSetMirror, sourceX, sourceY],
  );

  return {mirrorX, mirrorY};
}
