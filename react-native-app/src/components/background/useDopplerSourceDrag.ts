import {useCallback, useMemo, useRef} from 'react';
import {Gesture} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
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

/**
 * Draggable Doppler emitter — all gesture math runs on the JS thread (runOnJS),
 * matching RadialKnob / NeonSlider (refs are not safe inside UI worklets).
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

  const tierRef = useRef(tier);
  tierRef.current = tier;
  const scaleRef = useRef(beatSliderScale);
  scaleRef.current = beatSliderScale;

  const anchor = useMemo(
    () => beatPhaseToSourcePx(plotW, plotH, beatHz, phaseAngle, tier, beatSliderScale),
    [plotW, plotH, beatHz, phaseAngle, tier, beatSliderScale],
  );

  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  const originX = useRef(anchor.cx);
  const originY = useRef(anchor.cy);
  const lastCommitMs = useRef(0);

  const captureStart = useCallback(() => {
    originX.current = anchorRef.current.cx;
    originY.current = anchorRef.current.cy;
  }, []);

  const commitFromPx = useCallback((cx: number, cy: number, axis: 'x' | 'y' | 'both', force: boolean) => {
    const now = Date.now();
    if (!force && now - lastCommitMs.current < 70) {
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
  }, [setParam]);

  const applyDrag = useCallback(
    (translationX: number, translationY: number, isEnd: boolean) => {
      const w = plotWRef.current;
      const h = plotHRef.current;
      const cx = Math.min(w - 12, Math.max(12, originX.current + translationX));
      const cy = Math.min(h - 12, Math.max(12, originY.current + translationY));
      const axis = isEnd ? 'both' : dominantAxis(translationX, translationY);
      commitFromPx(cx, cy, axis, isEnd);
    },
    [commitFromPx],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          runOnJS(captureStart)();
        })
        .onUpdate(e => {
          runOnJS(applyDrag)(e.translationX, e.translationY, false);
        })
        .onEnd(e => {
          runOnJS(applyDrag)(e.translationX, e.translationY, true);
        }),
    [captureStart, applyDrag],
  );

  return {gesture, sourceX: anchor.cx, sourceY: anchor.cy};
}
