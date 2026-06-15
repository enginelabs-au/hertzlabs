export const MATH_GROUP_META: Record<
  string,
  {icon: string; title: string; blurb: string; deepDive: string}
> = {
  'Schumann Resonances': {
    icon: '🌍',
    title: 'Schumann Resonances',
    blurb: 'Primary Earth resonance baseline frequency.',
    deepDive:
      'Earth–ionosphere cavity eigenmodes from ~7.83 Hz upward. Each harmonic is a measurable atmospheric resonance, not an arbitrary preset.',
  },
  'Alpha Focus': {
    icon: '🎯',
    title: 'Alpha Focus',
    blurb: 'Standard 10 Hz cognitive baseline.',
    deepDive:
      'Peak alpha (8–12 Hz) supports relaxed, wakeful focus — the classic entrainment anchor for calm concentration.',
  },
  'Golden Ratio (φ)': {
    icon: 'φ',
    title: 'Golden Ratio',
    blurb: 'Proportional harmony through φ = 1.618.',
    deepDive:
      'Beat targets at φⁿ stack proportional intervals. Each step multiplies by the golden ratio for harmonic, non-linear spacing.',
  },
  Fibonacci: {
    icon: '∞',
    title: 'Fibonacci Sequences',
    blurb: 'Natural number sequences as frequency deltas.',
    deepDive:
      'F₇–F₁₀ Fibonacci terms (13–55 Hz) map sequential natural deltas onto SMR, beta, and gamma bands.',
  },
  Solfeggio: {
    icon: '♪',
    title: 'Solfeggio Frequencies',
    blurb: 'Ancient tuning system frequencies.',
    deepDive:
      'Sets the audible carrier to historic solfeggio tones (396–852 Hz) while keeping entrainment Δf in the binaural range.',
  },
};

export const CUSTOM_FORMULA_META = {
  icon: '∑',
  title: 'Custom Formula',
  tag: 'Manual',
  blurb: 'Build a beat target with symbols, constants, and live L/R variables.',
  deepDive:
    'Compose f_target from f_L, f_R, φ, π, and sqrt(). Apply to retune the playing differential instantly.',
};

export const AI_FORMULA_META = {
  icon: '✦',
  title: 'AI Formula',
  tag: 'Gemini',
  blurb: 'Describe a state or phenomenon — AI derives a math formula and applies it.',
  deepDive:
    'Ask about brain states, perceptual phenomena, or resonance patterns. The model returns a composable formula and retunes your session.',
};
