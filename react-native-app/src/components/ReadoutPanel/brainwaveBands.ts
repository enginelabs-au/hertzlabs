/**
 * Single source of truth for brainwave band boundaries, labels, and colors.
 * Consumed by BandLabel.tsx, useBrainwaveBand.ts, and ShaderLayer color tinting.
 *
 * The `hexColor` values drive both the band label text color and the ShaderLayer
 * per-layer color tint, ensuring visual consistency across the dial and readout.
 */
export const BRAINWAVE_BANDS = [
  { label: 'Epsilon', minHz: 0, maxHz: 0.5, hexColor: '#6B7FD7' },
  { label: 'Delta', minHz: 0.5, maxHz: 4, hexColor: '#8A6BBF' },
  { label: 'Theta', minHz: 4, maxHz: 8, hexColor: '#5BA3C9' },
  { label: 'Alpha', minHz: 8, maxHz: 12, hexColor: '#4DC9A0' },
  { label: 'SMR', minHz: 12, maxHz: 15, hexColor: '#A0D94D' },
  { label: 'Beta', minHz: 15, maxHz: 30, hexColor: '#F0C040' },
  { label: 'Gamma', minHz: 30, maxHz: 100, hexColor: '#F07040' },
  { label: 'Lambda', minHz: 100, maxHz: Infinity, hexColor: '#F04080' },
] as const;

export type BandName = (typeof BRAINWAVE_BANDS)[number]['label'];

/**
 * Returns the band whose [minHz, maxHz) range contains `hz`.
 * Falls back to Lambda (last entry) when `hz` exceeds all defined maxHz values.
 *
 * Note: worklet-safe only when used as a module-level constant accessed in a
 * loop — do not call this function directly inside useAnimatedReaction worklets.
 * Use the loop pattern from useBrainwaveBand.ts instead.
 */
export function getBand(hz: number): (typeof BRAINWAVE_BANDS)[number] {
  for (const band of BRAINWAVE_BANDS) {
    if (hz >= band.minHz && hz < band.maxHz) {
      return band;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1];
}
