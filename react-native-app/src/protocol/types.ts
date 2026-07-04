import type {EngineMode} from '../state/types';
import type {BreathPatternId} from '../breathPacer/patterns';

export type RampCurve = 'linear' | 'logarithmic';

/**
 * One timed segment of a frequency journey. The target Hz and volume sweep
 * continuously from start → end across the whole `durationSec` using `curve`.
 * (A constant hold is simply startBeatHz === endBeatHz.)
 */
export type ProtocolStep = {
  id: string;
  label: string;
  durationSec: number;
  startBeatHz: number;
  endBeatHz: number;
  curve: RampCurve;
  startGain: number;
  endGain: number;
  engineMode: EngineMode;
  /** When set, protocol playback switches breath pattern at this step. */
  breathPatternId?: BreathPatternId;
};

/** A multi-step frequency journey. Total length = sum of step durations + optional fade-out. */
export type SessionProtocol = {
  id: string;
  title: string;
  description: string;
  steps: ProtocolStep[];
  /** Sum of step durations + fade-out (auto-derived). */
  stopAfterSec: number;
  /** Pause playback when the journey completes. */
  stopAfterPlayback: boolean;
  /** End fade duration in seconds (0 = none). Plays after the last step. */
  fadeOutDurationSec: number;
  /** Volume at the start of the end fade (0–1). */
  fadeOutStartGain: number;
  /** Volume at the end of the end fade (0–1, typically near silence). */
  fadeOutEndGain: number;
};

export type ProtocolEvalState = {
  stepIndex: number;
  stepProgress: number;
  totalProgress: number;
  beatHz: number;
  gain: number;
  engineMode: EngineMode;
  stepLabel: string;
  remainingSec: number;
  isComplete: boolean;
};

export type ProtocolRingSegment = {
  stepIndex: number;
  label: string;
  startFraction: number;
  endFraction: number;
  startBeatHz: number;
  endBeatHz: number;
  color: string;
};
