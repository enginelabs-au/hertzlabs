/** Reference-aligned design tokens (Binaural Beats Pro / Hertz Labs). */
export const HertzTheme = {
  bg: '#0F0E17',
  bgCard: '#1C1C2E',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassFill: 'rgba(28,28,46,0.85)',
  neon: {
    cyan: '#5CE1FF',
    magenta: '#E879F9',
    purple: '#A78BFA',
    amber: '#FBBF24',
    lime: '#BEF264',
    green: '#4ADE80',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.55)',
    muted: 'rgba(255,255,255,0.38)',
    accent: '#93C5FD',
  },
  play: {
    idle: '#C4B5FD',
    playing: '#BEF264',
    pause: '#DC2626',
  },
  mono: 'JetBrainsMono-Regular',
} as const;

export function bandActionLabel(bandLabel: string): string {
  const map: Record<string, string> = {
    Epsilon: 'HEAL',
    Delta: 'REST',
    Theta: 'MEDITATE',
    Alpha: 'RELAX',
    SMR: 'FOCUS',
    Beta: 'DRIVE',
    Gamma: 'FLOW',
    Lambda: 'PEAK',
  };
  return map[bandLabel] ?? 'TUNE';
}
