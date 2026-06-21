import {isMacDesktopBuild} from './layoutProfile';

/** Modest bump for Mac Catalyst desktop — keeps layout, improves legibility. */
export const MAC_TYPOGRAPHY_SCALE = 1.22;

export function macScaledFont(baseSize: number): number {
  if (!isMacDesktopBuild()) {
    return baseSize;
  }
  return Math.round(baseSize * MAC_TYPOGRAPHY_SCALE * 10) / 10;
}
