import { Skia } from '@shopify/react-native-skia';

/**
 * Canonical dial canvas size in logical pixels.
 * Derived from a 320pt baseline; `SineWaveCanvas` overrides with
 * `useWindowDimensions` at runtime for smaller screens.
 */
export const DIAL_SIZE = 320;

/**
 * Precomputed Skia path objects for the circular dial ring.
 * Call once at module or component mount level — never inside a render loop.
 *
 * @param size - Canvas width/height in logical pixels (square canvas assumed).
 * @returns
 *   clipPath   — full-circle clip boundary for the canvas Group
 *   ringPath   — outer arc stroke at 0.88 × radius
 *   markerPath — radial tick-mark lines at every 45°
 */
export function makeDialPaths(size: number): {
  clipPath: ReturnType<typeof Skia.Path.Make>;
  ringPath: ReturnType<typeof Skia.Path.Make>;
  markerPath: ReturnType<typeof Skia.Path.Make>;
} {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const ringR = r * 0.88;
  const innerR = r * 0.82;

  const clipPath = Skia.Path.Make();
  clipPath.addCircle(cx, cy, r);

  const ringPath = Skia.Path.Make();
  ringPath.addCircle(cx, cy, ringR);

  const markerPath = Skia.Path.Make();
  for (let deg = 0; deg < 360; deg += 45) {
    const rad = (deg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    markerPath.moveTo(cx + innerR * cosA, cy + innerR * sinA);
    markerPath.lineTo(cx + ringR * cosA, cy + ringR * sinA);
  }

  return { clipPath, ringPath, markerPath };
}
