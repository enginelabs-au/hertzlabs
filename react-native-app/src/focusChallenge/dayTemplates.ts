import type {BreathPatternId} from '../breathPacer/patterns';
import type {EngineMode} from '../state/types';

export type FocusChallengePrescription = {
  title: string;
  body: string;
  beatHz: number;
  durationMin: number;
  breathPatternId: BreathPatternId;
  engineMode: EngineMode;
  asmrRain: number;
  asmrRoom: number;
};

const WEEK_FOCUS: Omit<FocusChallengePrescription, 'title' | 'body'> = {
  beatHz: 18,
  durationMin: 15,
  breathPatternId: 'box',
  engineMode: 'binaural',
  asmrRain: 0.15,
  asmrRoom: 0.1,
};

const WEEK_DEEPEN: Omit<FocusChallengePrescription, 'title' | 'body'> = {
  beatHz: 10,
  durationMin: 20,
  breathPatternId: 'resonant',
  engineMode: 'binaural',
  asmrRain: 0.2,
  asmrRoom: 0.15,
};

const WEEK_RAMP: Omit<FocusChallengePrescription, 'title' | 'body'> = {
  beatHz: 14,
  durationMin: 25,
  breathPatternId: '478',
  engineMode: 'binaural',
  asmrRain: 0.1,
  asmrRoom: 0.2,
};

const WEEK_CAPSTONE: Omit<FocusChallengePrescription, 'title' | 'body'> = {
  beatHz: 12,
  durationMin: 30,
  breathPatternId: '478',
  engineMode: 'binaural',
  asmrRain: 0.12,
  asmrRoom: 0.18,
};

function weekForDay(day: number): 1 | 2 | 3 | 4 {
  if (day <= 7) {
    return 1;
  }
  if (day <= 14) {
    return 2;
  }
  if (day <= 21) {
    return 3;
  }
  return 4;
}

export function focusChallengePrescriptionForDay(day: number): FocusChallengePrescription {
  const d = Math.min(30, Math.max(1, Math.floor(day)));
  const week = weekForDay(d);
  const base =
    week === 1
      ? WEEK_FOCUS
      : week === 2
        ? WEEK_DEEPEN
        : week === 3
          ? WEEK_RAMP
          : WEEK_CAPSTONE;
  const weekLabel =
    week === 1 ? 'Foundation focus' : week === 2 ? 'Deepening calm' : week === 3 ? 'Sustained focus' : 'Capstone';
  return {
    ...base,
    title: `Day ${d} · ${weekLabel}`,
    body: `${base.durationMin}-minute session at ${base.beatHz} Hz with ${base.breathPatternId} breathing and soft ambient texture.`,
  };
}

export const FOCUS_CHALLENGE_TOTAL_DAYS = 30;
export const FOCUS_CHALLENGE_MIN_PLAY_SEC = 600;
export const FOCUS_CHALLENGE_QUALIFY_RATIO = 0.8;

export function focusChallengeRequiredSec(durationMin: number): number {
  return Math.max(FOCUS_CHALLENGE_MIN_PLAY_SEC, Math.floor(durationMin * 60 * FOCUS_CHALLENGE_QUALIFY_RATIO));
}
