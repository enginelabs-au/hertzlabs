/** UI-thread beat slider mapping. Keep in sync with `beatHzSlider.ts`. */

/** 0 = linear, 1 = exponential (log). */
export const BEAT_SLIDER_SCALE_LINEAR = 0;
export const BEAT_SLIDER_SCALE_EXPONENTIAL = 1;

export function beatHzFromSliderNormWorklet(
  norm: number,
  minHz: number,
  maxHz: number,
  scale: number,
): number {
  'worklet';
  const n = Math.min(1, Math.max(0, norm));
  if (scale === BEAT_SLIDER_SCALE_LINEAR) {
    return minHz + n * (maxHz - minHz);
  }
  const logMin = Math.log(minHz);
  const logSpan = Math.log(maxHz) - logMin;
  return Math.exp(logMin + n * logSpan);
}

export function sliderNormFromBeatHzWorklet(
  hz: number,
  minHz: number,
  maxHz: number,
  scale: number,
): number {
  'worklet';
  const clamped = Math.min(maxHz, Math.max(minHz, hz));
  if (scale === BEAT_SLIDER_SCALE_LINEAR) {
    return (clamped - minHz) / (maxHz - minHz);
  }
  const logMin = Math.log(minHz);
  const logSpan = Math.log(maxHz) - logMin;
  return (Math.log(clamped) - logMin) / logSpan;
}

/** UI-thread quantize for live TARGET / dock labels (must be a worklet). */
export function quantizeBeatForDisplayWorklet(hz: number): number {
  'worklet';
  if (hz >= 10_000) {
    return Math.round(hz);
  }
  if (hz >= 1) {
    return Math.round(hz * 10) / 10;
  }
  return Math.round(hz * 1e12) / 1e12;
}
