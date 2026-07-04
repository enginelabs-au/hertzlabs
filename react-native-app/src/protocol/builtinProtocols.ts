import type {EngineMode} from '../state/types';
import {normalizeProtocol} from './interpolateProtocol';
import type {ProtocolStep, SessionProtocol} from './types';

/** Build alternating up/down sweep steps for cyclical reset journeys. */
function cyclicalSweepSteps(
  engineMode: EngineMode,
  swings = 8,
  halfSec = 150,
): ProtocolStep[] {
  const steps: ProtocolStep[] = [];
  for (let i = 0; i < swings; i++) {
    const up = i % 2 === 0;
    steps.push({
      id: `swing-${i}`,
      label: up ? 'Epsilon → Lambda' : 'Lambda → Epsilon',
      durationSec: halfSec,
      startBeatHz: up ? 0.5 : 100,
      endBeatHz: up ? 100 : 0.5,
      curve: 'logarithmic',
      startGain: 0.38,
      endGain: 0.38,
      engineMode,
    });
  }
  return steps;
}

function proto(
  partial: Omit<SessionProtocol, 'stopAfterSec' | 'stopAfterPlayback'> & {
    stopAfterSec?: number;
    stopAfterPlayback?: boolean;
  },
): SessionProtocol {
  return normalizeProtocol({
    stopAfterSec: 0,
    stopAfterPlayback: true,
    ...partial,
  });
}

const BINURAL_PRESETS: SessionProtocol[] = [
  proto({
    id: 'binaural-deep-work',
    title: 'Deep Work',
    description: 'Gamma spike into sustained Beta — classic dichotic focus arc.',
    steps: [
      {id: 'g', label: 'Gamma · 40 Hz', durationSec: 5 * 60, startBeatHz: 20, endBeatHz: 40, curve: 'linear', startGain: 0.5, endGain: 0.55, engineMode: 'binaural', breathPatternId: 'box'},
      {id: 'b', label: 'Beta · 18 Hz', durationSec: 45 * 60, startBeatHz: 40, endBeatHz: 18, curve: 'logarithmic', startGain: 0.55, endGain: 0.48, engineMode: 'binaural', breathPatternId: 'box'},
    ],
  }),
  proto({
    id: 'binaural-sleep',
    title: 'Sleep',
    description: 'Alpha → Theta → Delta descent with gentle volume fade.',
    steps: [
      {id: 'a', label: 'Alpha · 10 Hz', durationSec: 15 * 60, startBeatHz: 12, endBeatHz: 10, curve: 'linear', startGain: 0.42, endGain: 0.4, engineMode: 'binaural', breathPatternId: 'box'},
      {id: 't', label: 'Theta · 6 Hz', durationSec: 15 * 60, startBeatHz: 10, endBeatHz: 6, curve: 'logarithmic', startGain: 0.4, endGain: 0.34, engineMode: 'binaural', breathPatternId: '478'},
      {id: 'd', label: 'Delta · 1.5 Hz', durationSec: 30 * 60, startBeatHz: 6, endBeatHz: 1.5, curve: 'logarithmic', startGain: 0.34, endGain: 0.25, engineMode: 'binaural', breathPatternId: '478'},
    ],
  }),
  proto({
    id: 'binaural-neuro-reset',
    title: 'Neuro Reset',
    description: '20 min cyclical Epsilon ↔ Lambda sweep.',
    steps: cyclicalSweepSteps('binaural'),
  }),
  proto({
    id: 'binaural-calm',
    title: 'Calm Alpha',
    description: 'Settle from low Beta into steady Alpha relaxation.',
    steps: [
      {id: 'c1', label: 'Beta · 14 Hz', durationSec: 8 * 60, startBeatHz: 16, endBeatHz: 14, curve: 'linear', startGain: 0.45, endGain: 0.42, engineMode: 'binaural', breathPatternId: 'box'},
      {id: 'c2', label: 'Alpha · 10 Hz', durationSec: 22 * 60, startBeatHz: 14, endBeatHz: 10, curve: 'logarithmic', startGain: 0.42, endGain: 0.38, engineMode: 'binaural', breathPatternId: 'resonant'},
    ],
  }),
  proto({
    id: 'binaural-theta-drift',
    title: 'Theta Drift',
    description: 'Slow glide into deep Theta for meditation.',
    steps: [
      {id: 'td1', label: 'Alpha · 9 Hz', durationSec: 10 * 60, startBeatHz: 12, endBeatHz: 9, curve: 'linear', startGain: 0.44, endGain: 0.4, engineMode: 'binaural', breathPatternId: 'resonant'},
      {id: 'td2', label: 'Theta · 5 Hz', durationSec: 25 * 60, startBeatHz: 9, endBeatHz: 5, curve: 'logarithmic', startGain: 0.4, endGain: 0.32, engineMode: 'binaural', breathPatternId: '478'},
      {id: 'td3', label: 'Theta · 4 Hz', durationSec: 15 * 60, startBeatHz: 5, endBeatHz: 4, curve: 'linear', startGain: 0.32, endGain: 0.28, engineMode: 'binaural', breathPatternId: '478'},
    ],
  }),
];

const MONAURAL_PRESETS: SessionProtocol[] = [
  proto({
    id: 'monaural-open-focus',
    title: 'Open Focus',
    description: 'Speaker-friendly Beta climb for desk work.',
    steps: [
      {id: 'mf1', label: 'SMR · 14 Hz', durationSec: 10 * 60, startBeatHz: 12, endBeatHz: 14, curve: 'linear', startGain: 0.48, endGain: 0.5, engineMode: 'monaural'},
      {id: 'mf2', label: 'Beta · 20 Hz', durationSec: 35 * 60, startBeatHz: 14, endBeatHz: 20, curve: 'logarithmic', startGain: 0.5, endGain: 0.46, engineMode: 'monaural'},
    ],
  }),
  proto({
    id: 'monaural-evening',
    title: 'Evening Wind',
    description: 'Gradual Alpha descent through open-air interference.',
    steps: [
      {id: 'me1', label: 'Beta · 15 Hz', durationSec: 12 * 60, startBeatHz: 18, endBeatHz: 15, curve: 'linear', startGain: 0.44, endGain: 0.4, engineMode: 'monaural'},
      {id: 'me2', label: 'Alpha · 10 Hz', durationSec: 28 * 60, startBeatHz: 15, endBeatHz: 10, curve: 'logarithmic', startGain: 0.4, endGain: 0.34, engineMode: 'monaural'},
    ],
  }),
  proto({
    id: 'monaural-power-nap',
    title: 'Power Nap',
    description: 'Quick Theta dip then gentle return.',
    steps: [
      {id: 'mn1', label: 'Alpha · 10 Hz', durationSec: 5 * 60, startBeatHz: 12, endBeatHz: 10, curve: 'linear', startGain: 0.4, endGain: 0.38, engineMode: 'monaural'},
      {id: 'mn2', label: 'Theta · 6 Hz', durationSec: 15 * 60, startBeatHz: 10, endBeatHz: 6, curve: 'logarithmic', startGain: 0.38, endGain: 0.3, engineMode: 'monaural'},
      {id: 'mn3', label: 'Alpha · 10 Hz', durationSec: 5 * 60, startBeatHz: 6, endBeatHz: 10, curve: 'linear', startGain: 0.3, endGain: 0.36, engineMode: 'monaural'},
    ],
  }),
  proto({
    id: 'monaural-gamma-burst',
    title: 'Gamma Burst',
    description: 'Short high-frequency monaural spike for alertness.',
    steps: [
      {id: 'mg1', label: 'Beta · 18 Hz', durationSec: 8 * 60, startBeatHz: 14, endBeatHz: 18, curve: 'linear', startGain: 0.46, endGain: 0.5, engineMode: 'monaural'},
      {id: 'mg2', label: 'Gamma · 40 Hz', durationSec: 12 * 60, startBeatHz: 18, endBeatHz: 40, curve: 'logarithmic', startGain: 0.5, endGain: 0.48, engineMode: 'monaural'},
    ],
  }),
  proto({
    id: 'monaural-neuro-reset',
    title: 'Neuro Reset',
    description: 'Cyclical infrasonic ↔ lambda sweep (monaural).',
    steps: cyclicalSweepSteps('monaural'),
  }),
];

const ISOCHRONIC_PRESETS: SessionProtocol[] = [
  proto({
    id: 'isochronic-alert',
    title: 'Alert Pulse',
    description: 'Rhythmic isochronic climb into Beta/Gamma.',
    steps: [
      {id: 'ia1', label: 'Beta · 16 Hz', durationSec: 10 * 60, startBeatHz: 12, endBeatHz: 16, curve: 'linear', startGain: 0.5, endGain: 0.52, engineMode: 'isochronic'},
      {id: 'ia2', label: 'Gamma · 38 Hz', durationSec: 20 * 60, startBeatHz: 16, endBeatHz: 38, curve: 'logarithmic', startGain: 0.52, endGain: 0.48, engineMode: 'isochronic'},
    ],
  }),
  proto({
    id: 'isochronic-focus-block',
    title: 'Focus Block',
    description: 'Sustained SMR/Beta isochronic hold for deep work.',
    steps: [
      {id: 'if1', label: 'SMR · 14 Hz', durationSec: 15 * 60, startBeatHz: 10, endBeatHz: 14, curve: 'linear', startGain: 0.48, endGain: 0.5, engineMode: 'isochronic'},
      {id: 'if2', label: 'Beta · 18 Hz', durationSec: 30 * 60, startBeatHz: 14, endBeatHz: 18, curve: 'linear', startGain: 0.5, endGain: 0.46, engineMode: 'isochronic'},
    ],
  }),
  proto({
    id: 'isochronic-sleep',
    title: 'Sleep Pulse',
    description: 'Pulsed descent Alpha → Theta → Delta.',
    steps: [
      {id: 'is1', label: 'Alpha · 10 Hz', durationSec: 12 * 60, startBeatHz: 12, endBeatHz: 10, curve: 'linear', startGain: 0.44, endGain: 0.4, engineMode: 'isochronic'},
      {id: 'is2', label: 'Theta · 6 Hz', durationSec: 18 * 60, startBeatHz: 10, endBeatHz: 6, curve: 'logarithmic', startGain: 0.4, endGain: 0.32, engineMode: 'isochronic'},
      {id: 'is3', label: 'Delta · 2 Hz', durationSec: 25 * 60, startBeatHz: 6, endBeatHz: 2, curve: 'logarithmic', startGain: 0.32, endGain: 0.24, engineMode: 'isochronic'},
    ],
  }),
  proto({
    id: 'isochronic-meditation',
    title: 'Meditation',
    description: 'Slow Theta glide with soft volume taper.',
    steps: [
      {id: 'im1', label: 'Alpha · 9 Hz', durationSec: 10 * 60, startBeatHz: 11, endBeatHz: 9, curve: 'linear', startGain: 0.42, endGain: 0.38, engineMode: 'isochronic'},
      {id: 'im2', label: 'Theta · 5 Hz', durationSec: 30 * 60, startBeatHz: 9, endBeatHz: 5, curve: 'logarithmic', startGain: 0.38, endGain: 0.28, engineMode: 'isochronic'},
    ],
  }),
  proto({
    id: 'isochronic-neuro-reset',
    title: 'Neuro Reset',
    description: 'Cyclical sweep using isochronic pulses.',
    steps: cyclicalSweepSteps('isochronic'),
  }),
];

const HEMISPHERIC_PRESETS: SessionProtocol[] = [
  proto({
    id: 'hemi-flow',
    title: 'Flow State',
    description: 'Bilateral coherence arc into Alpha flow.',
    steps: [
      {id: 'hf1', label: 'Beta · 15 Hz', durationSec: 12 * 60, startBeatHz: 18, endBeatHz: 15, curve: 'linear', startGain: 0.46, endGain: 0.44, engineMode: 'hemisphericSync'},
      {id: 'hf2', label: 'Alpha · 10 Hz', durationSec: 28 * 60, startBeatHz: 15, endBeatHz: 10, curve: 'logarithmic', startGain: 0.44, endGain: 0.38, engineMode: 'hemisphericSync'},
    ],
  }),
  proto({
    id: 'hemi-creative',
    title: 'Creative Sync',
    description: 'Theta/Alpha blend for cross-hemispheric integration.',
    steps: [
      {id: 'hc1', label: 'Alpha · 10 Hz', durationSec: 15 * 60, startBeatHz: 12, endBeatHz: 10, curve: 'linear', startGain: 0.44, endGain: 0.4, engineMode: 'hemisphericSync'},
      {id: 'hc2', label: 'Theta · 7 Hz', durationSec: 25 * 60, startBeatHz: 10, endBeatHz: 7, curve: 'logarithmic', startGain: 0.4, endGain: 0.34, engineMode: 'hemisphericSync'},
    ],
  }),
  proto({
    id: 'hemi-deep-rest',
    title: 'Deep Rest',
    description: 'Slow Delta approach with phase-locked calm.',
    steps: [
      {id: 'hr1', label: 'Theta · 6 Hz', durationSec: 15 * 60, startBeatHz: 8, endBeatHz: 6, curve: 'linear', startGain: 0.4, endGain: 0.36, engineMode: 'hemisphericSync'},
      {id: 'hr2', label: 'Delta · 2 Hz', durationSec: 35 * 60, startBeatHz: 6, endBeatHz: 2, curve: 'logarithmic', startGain: 0.36, endGain: 0.26, engineMode: 'hemisphericSync'},
    ],
  }),
  proto({
    id: 'hemi-gamma-lift',
    title: 'Gamma Lift',
    description: 'Phase-aligned Gamma spike for peak clarity.',
    steps: [
      {id: 'hg1', label: 'Beta · 20 Hz', durationSec: 10 * 60, startBeatHz: 14, endBeatHz: 20, curve: 'linear', startGain: 0.48, endGain: 0.5, engineMode: 'hemisphericSync'},
      {id: 'hg2', label: 'Gamma · 40 Hz', durationSec: 15 * 60, startBeatHz: 20, endBeatHz: 40, curve: 'logarithmic', startGain: 0.5, endGain: 0.46, engineMode: 'hemisphericSync'},
    ],
  }),
  proto({
    id: 'hemi-neuro-reset',
    title: 'Neuro Reset',
    description: 'Bilateral cyclical Epsilon ↔ Lambda reset.',
    steps: cyclicalSweepSteps('hemisphericSync'),
  }),
];

const PHASE_MOD_PRESETS: SessionProtocol[] = [
  proto({
    id: 'phase-immersion',
    title: 'Immersion',
    description: 'Flowing phase-modulated Alpha → Theta journey.',
    steps: [
      {id: 'pi1', label: 'Alpha · 10 Hz', durationSec: 15 * 60, startBeatHz: 12, endBeatHz: 10, curve: 'linear', startGain: 0.46, endGain: 0.42, engineMode: 'phaseModulated'},
      {id: 'pi2', label: 'Theta · 6 Hz', durationSec: 25 * 60, startBeatHz: 10, endBeatHz: 6, curve: 'logarithmic', startGain: 0.42, endGain: 0.34, engineMode: 'phaseModulated'},
    ],
  }),
  proto({
    id: 'phase-focus-wave',
    title: 'Focus Wave',
    description: 'Fluid Beta sweep for sustained attention.',
    steps: [
      {id: 'pf1', label: 'SMR · 14 Hz', durationSec: 12 * 60, startBeatHz: 10, endBeatHz: 14, curve: 'linear', startGain: 0.48, endGain: 0.5, engineMode: 'phaseModulated'},
      {id: 'pf2', label: 'Beta · 22 Hz', durationSec: 33 * 60, startBeatHz: 14, endBeatHz: 22, curve: 'logarithmic', startGain: 0.5, endGain: 0.45, engineMode: 'phaseModulated'},
    ],
  }),
  proto({
    id: 'phase-dreamgate',
    title: 'Dreamgate',
    description: 'Twilight Theta glide with rich harmonic motion.',
    steps: [
      {id: 'pd1', label: 'Alpha · 9 Hz', durationSec: 10 * 60, startBeatHz: 11, endBeatHz: 9, curve: 'linear', startGain: 0.42, endGain: 0.38, engineMode: 'phaseModulated'},
      {id: 'pd2', label: 'Theta · 5 Hz', durationSec: 30 * 60, startBeatHz: 9, endBeatHz: 5, curve: 'logarithmic', startGain: 0.38, endGain: 0.28, engineMode: 'phaseModulated'},
    ],
  }),
  proto({
    id: 'phase-sleep',
    title: 'Sleep Flow',
    description: 'Phase-modulated descent into Delta.',
    steps: [
      {id: 'ps1', label: 'Theta · 6 Hz', durationSec: 15 * 60, startBeatHz: 8, endBeatHz: 6, curve: 'linear', startGain: 0.4, endGain: 0.36, engineMode: 'phaseModulated'},
      {id: 'ps2', label: 'Delta · 1.5 Hz', durationSec: 35 * 60, startBeatHz: 6, endBeatHz: 1.5, curve: 'logarithmic', startGain: 0.36, endGain: 0.24, engineMode: 'phaseModulated'},
    ],
  }),
  proto({
    id: 'phase-neuro-reset',
    title: 'Neuro Reset',
    description: 'Cyclical phase-modulated sweep.',
    steps: cyclicalSweepSteps('phaseModulated'),
  }),
];

const PITCH_PAN_PRESETS: SessionProtocol[] = [
  proto({
    id: 'pan-spatial-focus',
    title: 'Spatial Focus',
    description: 'Lateral Beta sweep for spatially encoded focus.',
    steps: [
      {id: 'pp1', label: 'SMR · 14 Hz', durationSec: 12 * 60, startBeatHz: 10, endBeatHz: 14, curve: 'linear', startGain: 0.48, endGain: 0.5, engineMode: 'pitchPanning'},
      {id: 'pp2', label: 'Beta · 20 Hz', durationSec: 33 * 60, startBeatHz: 14, endBeatHz: 20, curve: 'logarithmic', startGain: 0.5, endGain: 0.46, engineMode: 'pitchPanning'},
    ],
  }),
  proto({
    id: 'pan-calm-orbit',
    title: 'Calm Orbit',
    description: 'Gentle Alpha panning for relaxed awareness.',
    steps: [
      {id: 'pc1', label: 'Beta · 14 Hz', durationSec: 10 * 60, startBeatHz: 16, endBeatHz: 14, curve: 'linear', startGain: 0.44, endGain: 0.42, engineMode: 'pitchPanning'},
      {id: 'pc2', label: 'Alpha · 10 Hz', durationSec: 30 * 60, startBeatHz: 14, endBeatHz: 10, curve: 'logarithmic', startGain: 0.42, endGain: 0.36, engineMode: 'pitchPanning'},
    ],
  }),
  proto({
    id: 'pan-theta-voyage',
    title: 'Theta Voyage',
    description: 'Spatial Theta drift for deep meditation.',
    steps: [
      {id: 'pt1', label: 'Alpha · 9 Hz', durationSec: 12 * 60, startBeatHz: 11, endBeatHz: 9, curve: 'linear', startGain: 0.42, endGain: 0.38, engineMode: 'pitchPanning'},
      {id: 'pt2', label: 'Theta · 5 Hz', durationSec: 28 * 60, startBeatHz: 9, endBeatHz: 5, curve: 'logarithmic', startGain: 0.38, endGain: 0.3, engineMode: 'pitchPanning'},
    ],
  }),
  proto({
    id: 'pan-gamma-orbit',
    title: 'Gamma Orbit',
    description: 'High-frequency spatial spike.',
    steps: [
      {id: 'pg1', label: 'Beta · 18 Hz', durationSec: 8 * 60, startBeatHz: 14, endBeatHz: 18, curve: 'linear', startGain: 0.48, endGain: 0.5, engineMode: 'pitchPanning'},
      {id: 'pg2', label: 'Gamma · 40 Hz', durationSec: 12 * 60, startBeatHz: 18, endBeatHz: 40, curve: 'logarithmic', startGain: 0.5, endGain: 0.46, engineMode: 'pitchPanning'},
    ],
  }),
  proto({
    id: 'pan-neuro-reset',
    title: 'Neuro Reset',
    description: 'Cyclical spatial Epsilon ↔ Lambda reset.',
    steps: cyclicalSweepSteps('pitchPanning'),
  }),
];

export const PROTOCOL_PRESETS_BY_ENGINE: Record<EngineMode, SessionProtocol[]> = {
  binaural: BINURAL_PRESETS,
  monaural: MONAURAL_PRESETS,
  isochronic: ISOCHRONIC_PRESETS,
  hemisphericSync: HEMISPHERIC_PRESETS,
  phaseModulated: PHASE_MOD_PRESETS,
  pitchPanning: PITCH_PAN_PRESETS,
  musicModulation: BINURAL_PRESETS,
};

export function getProtocolsForEngine(mode: EngineMode): SessionProtocol[] {
  return PROTOCOL_PRESETS_BY_ENGINE[mode] ?? BINURAL_PRESETS;
}

/** @deprecated Use getProtocolsForEngine — kept for AI imports. */
export const BUILTIN_PROTOCOLS: SessionProtocol[] = BINURAL_PRESETS;
