import type {EngineMode} from '../../state/types';

export type HomeQuickClip = {
  label: string;
  beatHz: number;
  engineMode: EngineMode;
  gain: number;
};

/** Instant-apply home clips — no protocol/AI round-trip. */
export const HOME_QUICK_CLIPS: HomeQuickClip[] = [
  {label: 'ADHD Focus', beatHz: 14, engineMode: 'binaural', gain: 0.28},
  {label: 'Deep Sleep', beatHz: 2.5, engineMode: 'binaural', gain: 0.15},
  {label: 'Anxiety Relief', beatHz: 8, engineMode: 'binaural', gain: 0.18},
  {label: 'Creative Flow', beatHz: 10, engineMode: 'binaural', gain: 0.25},
  {label: 'Lucid Dream', beatHz: 5, engineMode: 'binaural', gain: 0.2},
  {label: 'Meditation', beatHz: 6, engineMode: 'binaural', gain: 0.22},
  {label: 'Flow State', beatHz: 12, engineMode: 'binaural', gain: 0.25},
  {label: 'Power Nap', beatHz: 4.5, engineMode: 'binaural', gain: 0.2},
  {label: 'Calm Down', beatHz: 9.5, engineMode: 'binaural', gain: 0.22},
  {label: 'Energy Boost', beatHz: 20, engineMode: 'isochronic', gain: 0.35},
  {label: 'Memory Focus', beatHz: 40, engineMode: 'monaural', gain: 0.3},
  {label: 'Pain Relief', beatHz: 10, engineMode: 'binaural', gain: 0.2},
  {label: 'Study Mode', beatHz: 16, engineMode: 'binaural', gain: 0.26},
  {label: 'Wind Down', beatHz: 7, engineMode: 'binaural', gain: 0.18},
];
