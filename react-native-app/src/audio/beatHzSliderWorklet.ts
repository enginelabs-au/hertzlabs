/** UI-thread beat slider mapping (log scale). Keep in sync with `beatHzSlider.ts`. */

export function beatHzFromSliderNormWorklet(norm: number, logMin: number, logSpan: number): number {
  'worklet';
  const n = Math.min(1, Math.max(0, norm));
  return Math.exp(logMin + n * logSpan);
}

export function sliderNormFromBeatHzWorklet(hz: number, logMin: number, logSpan: number): number {
  'worklet';
  const clamped = Math.max(logMin, Math.min(logMin + logSpan, Math.log(Math.max(hz, 1e-6))));
  return (clamped - logMin) / logSpan;
}
