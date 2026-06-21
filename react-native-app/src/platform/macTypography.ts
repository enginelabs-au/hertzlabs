import {isMacDesktopBuild} from './layoutProfile';

/** Modest bump for Mac Catalyst desktop — keeps layout, improves legibility. */
export const MAC_TYPOGRAPHY_SCALE = 1.28;

export function macScaledFont(baseSize: number): number {
  if (!isMacDesktopBuild()) {
    return baseSize;
  }
  return Math.round(baseSize * MAC_TYPOGRAPHY_SCALE * 10) / 10;
}

/** Band chip label sizes — same phone formula; Mac gets modest macScaledFont only. */
export function macBandChipFontSizes(
  compact: boolean,
  chipWidth: number,
): {labelSize: number; rangeSize: number} {
  const labelSize = Math.min(compact ? 6 : 6.5, Math.max(5, chipWidth * 0.14));
  const rangeSize = Math.min(compact ? 5 : 5.5, Math.max(4, chipWidth * 0.11));
  if (!isMacDesktopBuild()) {
    return {labelSize, rangeSize};
  }
  return {
    labelSize: macScaledFont(labelSize),
    rangeSize: macScaledFont(rangeSize),
  };
}
