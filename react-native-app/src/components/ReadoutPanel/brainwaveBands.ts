/**
 * Brainwave / entrainment bands — labels and colors match the in-hub frequency bar UI.
 */
export const BRAINWAVE_BANDS = [
  {label: 'HEALING', rangeLabel: '<0.5Hz', minHz: 0, maxHz: 0.5, hexColor: '#8B72C6'},
  {label: 'DREAM', rangeLabel: '0.5–4Hz', minHz: 0.5, maxHz: 4, hexColor: '#4A6FA5'},
  {label: 'MEDITATE', rangeLabel: '4–8Hz', minHz: 4, maxHz: 8, hexColor: '#3BA8C4'},
  {label: 'CALM', rangeLabel: '8–12Hz', minHz: 8, maxHz: 12, hexColor: '#5CB87A'},
  {label: 'FOCUS', rangeLabel: '12–15Hz', minHz: 12, maxHz: 15, hexColor: '#B8D45A'},
  {label: 'ENGAGED', rangeLabel: '15–30Hz', minHz: 15, maxHz: 30, hexColor: '#C4864A'},
  {label: 'COGNITION', rangeLabel: '30–100Hz', minHz: 30, maxHz: Infinity, hexColor: '#E0639A'},
] as const;

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

export function formatBeatDisplay(hz: number): string {
  if (hz >= 100) {
    return hz.toFixed(0);
  }
  if (hz >= 10) {
    return hz.toFixed(1);
  }
  return hz.toFixed(2);
}
