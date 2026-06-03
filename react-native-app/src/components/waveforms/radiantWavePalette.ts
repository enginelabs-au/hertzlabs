/**
 * Soft neon tints from the original SineWaveCanvas shader layers (git HEAD).
 * Used for all Skia path waves — gentle transparency, layered glow.
 */
export type RgbaTint = {r: number; g: number; b: number; a: number};

export const SHADER_WAVE_TINTS: readonly RgbaTint[] = [
  {r: 75, g: 120, b: 255, a: 0.7}, // indigo-blue
  {r: 100, g: 200, b: 180, a: 0.6}, // teal
  {r: 200, g: 100, b: 255, a: 0.5}, // violet
  {r: 255, g: 160, b: 60, a: 0.4}, // amber
] as const;

export type RadiantStrokeStyle = {
  halo: string;
  glow: string;
  core: string;
};

export function radiantStrokeFromTint(tint: RgbaTint): RadiantStrokeStyle {
  const {r, g, b, a} = tint;
  return {
    halo: `rgba(${r}, ${g}, ${b}, ${(a * 0.2).toFixed(3)})`,
    glow: `rgba(${r}, ${g}, ${b}, ${(a * 0.36).toFixed(3)})`,
    core: `rgba(${r}, ${g}, ${b}, ${Math.min(0.78, a * 0.92).toFixed(3)})`,
  };
}

/** Stacked header / strip: violet, indigo, amber */
export const STRIP_WAVE_STROKES: RadiantStrokeStyle[] = [
  radiantStrokeFromTint(SHADER_WAVE_TINTS[2]),
  radiantStrokeFromTint(SHADER_WAVE_TINTS[0]),
  radiantStrokeFromTint(SHADER_WAVE_TINTS[3]),
];

export const STROKE_CYAN = radiantStrokeFromTint(SHADER_WAVE_TINTS[0]);
export const STROKE_TEAL = radiantStrokeFromTint(SHADER_WAVE_TINTS[1]);
export const STROKE_VIOLET = radiantStrokeFromTint(SHADER_WAVE_TINTS[2]);
export const STROKE_AMBER = radiantStrokeFromTint(SHADER_WAVE_TINTS[3]);
