import {useWindowDimensions} from 'react-native';

/** Width of the embedded phase slider column (right edge of hub). */
export const PHASE_COLUMN_W = 44;

/** @deprecated Use PHASE_COLUMN_W */
export const SLIDER_COLUMN_W = PHASE_COLUMN_W;
export const PHASE_COL_W = PHASE_COLUMN_W;

/** Horizontal beat slider docked at the bottom inside the glass frame. */
export const IN_FRAME_BEAT_SLIDER_H = 52;

/** Coloured brainwave band strip below the hub (above category tabs). */
export const EXTERNAL_BAND_BAR_H = 56;

/** Shared hub / visualizer dimensions. */
export function useHubLayout() {
  const {width: screenWidth} = useWindowDimensions();
  const hubW = screenWidth - 24;
  const frameH = Math.min(278, Math.max(238, hubW * 0.66));
  const canvasH = frameH - IN_FRAME_BEAT_SLIDER_H;
  const canvasW = Math.max(64, hubW - PHASE_COLUMN_W);
  const beatSliderW = Math.max(120, canvasW - 20);
  return {
    hubW,
    frameH,
    canvasH,
    canvasW,
    beatSliderW,
    phaseColW: PHASE_COLUMN_W,
    beatSliderH: IN_FRAME_BEAT_SLIDER_H,
    externalBandBarH: EXTERNAL_BAND_BAR_H,
    screenWidth,
  };
}
