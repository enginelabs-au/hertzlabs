import { Skia } from '@shopify/react-native-skia';

/**
 * SkSL shader source — exactly as specified in Plan 03 Section 3.2.
 *
 * Design notes:
 *  - Polar coordinates (angle, radius) let the wave wrap naturally around the dial.
 *  - `wave` modulates the drawn ring radius → morphing/warping sine ring.
 *  - `rippleWave` adds a radial standing-wave when gestureActive = 1.0.
 *  - `warp` injects horizontal sine distortion proportional to timingDiffMs.
 *  - `smoothstep` anti-aliases the ring edge without MSAA cost.
 *  - Returns alpha only; color is composited by the ShaderLayer's Paint color.
 *  - `layerIndex` drives per-layer frequency and phase multipliers so the single
 *    shader produces four visually distinct wave layers.
 */
export const SINE_WAVE_SKSL = `
uniform float  time;
uniform float  frequency;
uniform float  phase;
uniform float  ripple;
uniform float  warpAmount;
uniform float2 resolution;
uniform int    layerIndex;
uniform float4 tintColor;

half4 main(float2 fragCoord) {
  float2 uv     = fragCoord / resolution;
  float2 center = float2(0.5, 0.5);
  float2 p      = uv - center;
  float  angle  = atan(p.y, p.x);
  float  radius = length(p);

  float freqMult  = 1.0 + float(layerIndex) * 0.5;
  float phaseMult = 1.0 - float(layerIndex) * 0.25;

  float wave = sin(
    angle * frequency * freqMult
    + phase * phaseMult
    + time * (1.0 + float(layerIndex) * 0.3)
  );

  float rippleWave = sin(radius * 20.0 - time * 4.0) * ripple * 0.15;
  float warp       = sin(uv.x * 6.2832 + warpAmount) * 0.02;

  float dist  = abs(radius - (0.35 + wave * 0.04 + rippleWave + warp));
  float alpha = smoothstep(0.012, 0.002, dist);

  return half4(tintColor.rgb * alpha, tintColor.a * alpha);
}
`;

/**
 * Compiled RuntimeEffect — created once at module load, never inside a component.
 * All four ShaderLayer instances share this single compiled effect; they differ
 * only in their per-layer uniforms.
 */
export const sineWaveEffect = Skia.RuntimeEffect.Make(SINE_WAVE_SKSL)!;
