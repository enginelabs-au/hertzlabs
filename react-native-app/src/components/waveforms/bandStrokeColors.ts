import type {RadiantStrokeStyle} from './radiantWavePalette';

function parseHex(hex: string): {r: number; g: number; b: number} {
  'worklet';
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  if (!Number.isFinite(n)) {
    return {r: 92, g: 225, b: 255};
  }
  return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
}

/** Waveform stroke colours from active band hex + intensity (gain + beat Hz). */
export function bandStrokeFromHex(hex: string, intensity: number): RadiantStrokeStyle {
  'worklet';
  const {r, g, b} = parseHex(hex);
  const t = Math.min(1, Math.max(0.35, intensity));
  return {
    halo: `rgba(${r}, ${g}, ${b}, ${(t * 0.24).toFixed(3)})`,
    glow: `rgba(${r}, ${g}, ${b}, ${(t * 0.52).toFixed(3)})`,
    core: `rgba(${r}, ${g}, ${b}, ${Math.min(1, t * 0.96).toFixed(3)})`,
  };
}
