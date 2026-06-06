import {useWindowDimensions} from 'react-native';
import {useHertzStore} from '../state/store';

/** Width of the embedded phase slider column (right edge of hub). */
export const PHASE_COLUMN_W = 44;

/** @deprecated Use PHASE_COLUMN_W */
export const SLIDER_COLUMN_W = PHASE_COLUMN_W;
export const PHASE_COL_W = PHASE_COLUMN_W;

/** Horizontal beat slider docked at the bottom inside the glass frame. */
export const IN_FRAME_BEAT_SLIDER_H = 52;

/** Width of the vertical brainwave band rail (left edge of hub; mirrors the phase column). */
export const BAND_RAIL_W = 58;

/** Coloured brainwave band strip below the hub. @deprecated replaced by the in-frame vertical rail (BAND_RAIL_W). */
export const EXTERNAL_BAND_BAR_H = 56;

/** Extra beat-dock height in Experimental mode to fit the flanking dials + text fields. */
export const EXPERIMENTAL_DOCK_EXTRA_H = 56;

/** Shared hub / visualizer dimensions. */
export function useHubLayout() {
  const {width: screenWidth} = useWindowDimensions();
  const experimental = useHertzStore(s => s.experimentalMode);
  const hubW = screenWidth - 24;
  // Taller frame so the 11-band vertical rail stays readable (mirrors phase column).
  const baseFrameH = Math.min(308, Math.max(272, hubW * 0.74));
  // Experimental mode grows the dock (and frame) so the canvas size is unchanged.
  const expExtra = experimental ? EXPERIMENTAL_DOCK_EXTRA_H : 0;
  const beatSliderH = IN_FRAME_BEAT_SLIDER_H + expExtra;
  const frameH = baseFrameH + expExtra;
  const canvasH = frameH - beatSliderH;
  const canvasW = Math.max(64, hubW - PHASE_COLUMN_W - BAND_RAIL_W);
  const beatSliderW = Math.max(120, canvasW - 20);
  return {
    hubW,
    frameH,
    canvasH,
    canvasW,
    beatSliderW,
    phaseColW: PHASE_COLUMN_W,
    bandRailW: BAND_RAIL_W,
    beatSliderH,
    externalBandBarH: EXTERNAL_BAND_BAR_H,
    experimental,
    screenWidth,
  };
}
