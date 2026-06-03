type Rgb = {r: number; g: number; b: number};

const GRADIENT: Rgb[] = [
  {r: 190, g: 255, b: 80},
  {r: 92, g: 225, b: 255},
  {r: 60, g: 120, b: 255},
  {r: 120, g: 100, b: 255},
  {r: 167, g: 139, b: 250},
  {r: 232, g: 121, b: 249},
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

/** Spectral ring colour with audio-driven undulation (0…1 along radius + time wave). */
export function dopplerGradientColor(
  radialT: number,
  timeSec: number,
  beatHz: number,
  phaseDeg: number,
  audioWave: number,
  alpha = 0.78,
): string {
  const beat = Math.max(0.05, beatHz);
  const ripple =
    Math.sin(timeSec * beat * Math.PI * 2 * 0.5 + radialT * 8 + (phaseDeg * Math.PI) / 180) *
      0.14 +
    audioWave * 0.1;
  const t = ((radialT + ripple) % 1 + 1) % 1;
  const seg = t * (GRADIENT.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const rgb = lerpRgb(GRADIENT[i], GRADIENT[Math.min(i + 1, GRADIENT.length - 1)], f);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}
