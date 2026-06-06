/**
 * Brainwave / entrainment bands.
 *
 * Two parallel naming systems per band:
 *   - `scientific` — EEG/physiology term shown in the TARGET readout. Standard
 *     where established (delta…high-gamma); above high-gamma the labels denote
 *     experimental modulation ranges, not clinical EEG classes (see the legal
 *     onboarding disclaimer).
 *   - `label` — wellness word shown on the coloured band rail (kept as `label`
 *     for backward compatibility with the brainwave readout components).
 *
 * Colours: bands ≤ Gamma use the original muted palette; the four bands above
 * Gamma use vivid "laser" hues (red → magenta → violet → azure) chosen to read
 * as neon and stay distinct from the muted base palette. The final EXPERIMENTAL
 * band (Experimental-mode only) uses an ultra-light "ice" tone unlike any other.
 *
 * Boundary note: Omega's `maxHz` is 501 (not 500) so the premium slider ceiling
 * of exactly 500 Hz still resolves to Omega; the EXPERIMENTAL band only takes
 * over above the normal range once Experimental mode unlocks it.
 */
export const BRAINWAVE_BANDS = [
  {label: 'HEALING', scientific: 'Infra-slow', rangeLabel: '<0.5Hz', minHz: 0, maxHz: 0.5, hexColor: '#8B72C6'},
  {label: 'DREAM', scientific: 'Delta', rangeLabel: '0.5–4Hz', minHz: 0.5, maxHz: 4, hexColor: '#4A6FA5'},
  {label: 'MEDITATE', scientific: 'Theta', rangeLabel: '4–8Hz', minHz: 4, maxHz: 8, hexColor: '#3BA8C4'},
  {label: 'CALM', scientific: 'Alpha', rangeLabel: '8–12Hz', minHz: 8, maxHz: 12, hexColor: '#5CB87A'},
  {label: 'FOCUS', scientific: 'Alpha-beta', rangeLabel: '12–15Hz', minHz: 12, maxHz: 15, hexColor: '#B8D45A'},
  {label: 'ENGAGED', scientific: 'Beta', rangeLabel: '15–30Hz', minHz: 15, maxHz: 30, hexColor: '#C4864A'},
  {label: 'COGNITION', scientific: 'Gamma', rangeLabel: '30–50Hz', minHz: 30, maxHz: 50, hexColor: '#E0639A'},
  {label: 'INSIGHT', scientific: 'High-gamma', rangeLabel: '50–80Hz', minHz: 50, maxHz: 80, hexColor: '#FF2D4B'},
  {label: 'SYNTHESIS', scientific: 'Very high-gamma', rangeLabel: '80–150Hz', minHz: 80, maxHz: 150, hexColor: '#FF2EC4'},
  {label: 'INTEGRATION', scientific: 'Supra-gamma', rangeLabel: '150–280Hz', minHz: 150, maxHz: 280, hexColor: '#A24BFF'},
  {label: 'INFINITE', scientific: 'Omega', rangeLabel: '280–500Hz', minHz: 280, maxHz: 501, hexColor: '#2F7DFF'},
  {label: 'EXPERIMENT', scientific: 'Experimental', rangeLabel: '>500Hz', minHz: 501, maxHz: 1_000_000, hexColor: '#EAF7FF'},
] as const;

/** Index of the Experimental-mode-only band (audible range above Omega). */
export const EXPERIMENTAL_BAND_INDEX = BRAINWAVE_BANDS.length - 1;

/**
 * Bands shown on the vertical rail. The EXPERIMENTAL band is hidden until
 * Experimental mode is enabled (it unlocks the >500 Hz audible range).
 */
export function railBands(
  experimental: boolean,
): readonly (typeof BRAINWAVE_BANDS)[number][] {
  return experimental ? BRAINWAVE_BANDS : BRAINWAVE_BANDS.slice(0, EXPERIMENTAL_BAND_INDEX);
}

/** Segments shown in the hub frequency bar (excludes premium-only tail above 100 Hz). */
export const HUB_BAND_SEGMENTS = BRAINWAVE_BANDS.filter(b => b.maxHz <= 100 || b.minHz < 100);

export type BandName = (typeof BRAINWAVE_BANDS)[number]['label'];

export function getBand(hz: number): (typeof BRAINWAVE_BANDS)[number] {
  'worklet';
  if (!Number.isFinite(hz)) {
    return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1];
  }
  const safe = hz < 0 ? 0 : hz;
  for (const band of BRAINWAVE_BANDS) {
    if (safe >= band.minHz && safe < band.maxHz) {
      return band;
    }
  }
  return BRAINWAVE_BANDS[BRAINWAVE_BANDS.length - 1];
}

export function getBandIndex(hz: number): number {
  'worklet';
  if (!Number.isFinite(hz)) {
    return BRAINWAVE_BANDS.length - 1;
  }
  const safe = hz < 0 ? 0 : hz;
  for (let i = 0; i < BRAINWAVE_BANDS.length; i++) {
    if (safe >= BRAINWAVE_BANDS[i].minHz && safe < BRAINWAVE_BANDS[i].maxHz) {
      return i;
    }
  }
  return BRAINWAVE_BANDS.length - 1;
}

export type BeatFrequencyUnit = 'Hz' | 'kHz' | 'MHz';

/** Unit suffix for the TARGET readout (switches at 1 kHz / 1 MHz). */
export function formatBeatUnit(hz: number): BeatFrequencyUnit {
  if (!Number.isFinite(hz) || hz <= 0) {
    return 'Hz';
  }
  if (hz >= 1_000_000) {
    return 'MHz';
  }
  if (hz >= 1000) {
    return 'kHz';
  }
  return 'Hz';
}

export function formatBeatDisplay(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) {
    return '0';
  }
  if (hz >= 1_000_000) {
    return (hz / 1_000_000).toPrecision(3);
  }
  if (hz >= 1000) {
    const k = hz / 1000;
    if (k >= 100) {
      return k.toFixed(0);
    }
    if (k >= 10) {
      return k.toFixed(1);
    }
    return k.toFixed(2);
  }
  if (hz >= 100) {
    return hz.toFixed(0);
  }
  if (hz >= 10) {
    return hz.toFixed(1);
  }
  // Experimental-mode sub-Hz modulation: keep it legible instead of "0.00".
  if (hz > 0 && hz < 0.01) {
    return hz.toExponential(1);
  }
  return hz.toFixed(2);
}
