import type {BeatSliderScale} from './beatHzSlider';

/** Smallest non-zero mix used for exponential slider mapping (0 stays silent). */
const MIN_NONZERO_MIX = 0.001;
const MAX_MIX = 1;

function mapMixToTrackNorm(mix: number, scale: BeatSliderScale): number {
  const clamped = Math.min(MAX_MIX, Math.max(0, mix));
  if (clamped <= 0) {
    return 0;
  }
  if (scale === 'linear') {
    return clamped;
  }
  const logMin = Math.log(MIN_NONZERO_MIX);
  const logMax = Math.log(MAX_MIX);
  return (Math.log(Math.max(clamped, MIN_NONZERO_MIX)) - logMin) / (logMax - logMin);
}

function mapTrackNormToMix(norm: number, scale: BeatSliderScale): number {
  const n = Math.min(1, Math.max(0, norm));
  if (n <= 0) {
    return 0;
  }
  if (scale === 'linear') {
    return n;
  }
  const logMin = Math.log(MIN_NONZERO_MIX);
  const logMax = Math.log(MAX_MIX);
  return Math.exp(logMin + n * (logMax - logMin));
}

export function noiseMixToSliderNorm(
  mix: number,
  scale: BeatSliderScale = 'exponential',
): number {
  return mapMixToTrackNorm(mix, scale);
}

export function sliderNormToNoiseMix(
  norm: number,
  scale: BeatSliderScale = 'exponential',
): number {
  return mapTrackNormToMix(norm, scale);
}
