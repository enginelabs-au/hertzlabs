import {useWindowDimensions} from 'react-native';

/** Width reserved for the phase column inside the hub card. */
export const PHASE_COLUMN_W = 44;

/** Shared hub dimensions so oscilloscope and phase slider align. */
export function useHubLayout() {
  const {width: screenWidth} = useWindowDimensions();
  const hubW = screenWidth - 24;
  const hubH = Math.min(300, Math.max(260, hubW * 0.72));
  const canvasW = Math.max(64, hubW - PHASE_COLUMN_W);
  return {hubW, hubH, canvasW, phaseColW: PHASE_COLUMN_W, screenWidth};
}
