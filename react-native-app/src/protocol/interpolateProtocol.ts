import {getBandColor} from '../components/ai/aiGuideGenerator';
import {isBreathPatternId} from '../breathPacer/patterns';
import type {
  ProtocolEvalState,
  ProtocolRingSegment,
  ProtocolStep,
  RampCurve,
  SessionProtocol,
} from './types';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Interpolate start→end at progress t (0..1), linearly or logarithmically. */
export function interpolateScalar(
  start: number,
  end: number,
  t: number,
  curve: RampCurve,
): number {
  const p = clamp(t, 0, 1);
  if (start === end) {
    return start;
  }
  if (curve === 'logarithmic' && start > 0 && end > 0) {
    const logStart = Math.log(start);
    const logEnd = Math.log(end);
    return Math.exp(logStart + (logEnd - logStart) * p);
  }
  return start + (end - start) * p;
}

export function computeStepsTotalSec(steps: ProtocolStep[]): number {
  return steps.reduce((sum, s) => sum + Math.max(1, s.durationSec), 0);
}

/** Full journey length including optional end fade-out. */
export function computeProtocolTotalSec(protocol: SessionProtocol): number;
export function computeProtocolTotalSec(steps: ProtocolStep[]): number;
export function computeProtocolTotalSec(
  protocolOrSteps: SessionProtocol | ProtocolStep[],
): number {
  if (Array.isArray(protocolOrSteps)) {
    return computeStepsTotalSec(protocolOrSteps);
  }
  const stepsTotal = computeStepsTotalSec(protocolOrSteps.steps);
  const fade = Math.max(0, Math.round(protocolOrSteps.fadeOutDurationSec ?? 0));
  return stepsTotal + fade;
}

/** Scale every step duration so the journey matches `targetTotalMin` minutes. */
export function scaleProtocolStepsToTotalMin(
  steps: ProtocolStep[],
  targetTotalMin: number,
): ProtocolStep[] {
  return scaleProtocolStepsToTotalSec(steps, Math.round(targetTotalMin * 60));
}

/** Scale every step duration so the journey matches `targetSec` seconds. */
export function scaleProtocolStepsToTotalSec(
  steps: ProtocolStep[],
  targetSec: number,
): ProtocolStep[] {
  const currentTotal = computeStepsTotalSec(steps);
  const target = Math.max(15, Math.round(targetSec));
  if (currentTotal <= 0 || steps.length === 0) {
    return steps;
  }
  const scale = target / currentTotal;
  return steps.map(s => ({
    ...s,
    durationSec: Math.max(1, Math.round(s.durationSec * scale)),
  }));
}

function lastStep(protocol: SessionProtocol): ProtocolStep | null {
  return protocol.steps.length > 0 ? protocol.steps[protocol.steps.length - 1] : null;
}

/** Resolve the live target params at `elapsedSec` into the journey. */
export function evaluateProtocolAt(
  protocol: SessionProtocol,
  elapsedSec: number,
  fallbackGain = 0.45,
): ProtocolEvalState {
  const steps = protocol.steps;
  const stepsTotal = Math.max(1, computeStepsTotalSec(steps));
  const fadeSec = Math.max(0, Math.round(protocol.fadeOutDurationSec ?? 0));
  const total = stepsTotal + fadeSec;
  const elapsed = Math.max(0, elapsedSec);

  if (steps.length === 0) {
    return {
      stepIndex: 0,
      stepProgress: 0,
      totalProgress: 0,
      beatHz: 10,
      gain: fallbackGain,
      engineMode: 'binaural',
      stepLabel: '—',
      remainingSec: 0,
      isComplete: true,
    };
  }

  const tail = lastStep(protocol)!;

  if (elapsed >= stepsTotal && fadeSec > 0) {
    const inFade = clamp(elapsed - stepsTotal, 0, fadeSec);
    const p = clamp(inFade / fadeSec, 0, 1);
    const gain = interpolateScalar(protocol.fadeOutStartGain, protocol.fadeOutEndGain, p, 'linear');
    const complete = elapsed >= total;
    return {
      stepIndex: steps.length - 1,
      stepProgress: 1,
      totalProgress: clamp(elapsed / total, 0, 1),
      beatHz: clamp(tail.endBeatHz, 0.5, 500),
      gain: clamp(gain, 0, 1),
      engineMode: tail.engineMode,
      stepLabel: complete ? 'Fade complete' : 'Fade out',
      remainingSec: Math.max(0, total - elapsed),
      isComplete: complete,
    };
  }

  let cursor = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepEnd = cursor + step.durationSec;
    const isLast = i === steps.length - 1;
    if (elapsed < stepEnd || isLast) {
      const inStep = clamp(elapsed - cursor, 0, step.durationSec);
      const p = clamp(inStep / Math.max(step.durationSec, 0.001), 0, 1);
      const beatHz = interpolateScalar(step.startBeatHz, step.endBeatHz, p, step.curve);
      const gain = interpolateScalar(step.startGain, step.endGain, p, 'linear');
      const complete = elapsed >= total;
      return {
        stepIndex: i,
        stepProgress: p,
        totalProgress: clamp(elapsed / total, 0, 1),
        beatHz: clamp(beatHz, 0.5, 500),
        gain: clamp(gain, 0.04, 1),
        engineMode: step.engineMode,
        stepLabel: step.label,
        remainingSec: Math.max(0, total - elapsed),
        isComplete: complete,
      };
    }
    cursor = stepEnd;
  }

  return {
    stepIndex: steps.length - 1,
    stepProgress: 1,
    totalProgress: 1,
    beatHz: clamp(tail.endBeatHz, 0.5, 500),
    gain: clamp(tail.endGain, 0.04, 1),
    engineMode: tail.engineMode,
    stepLabel: tail.label,
    remainingSec: 0,
    isComplete: true,
  };
}

export function buildRingSegments(protocol: SessionProtocol): ProtocolRingSegment[] {
  const total = Math.max(1, computeProtocolTotalSec(protocol));
  let cursor = 0;
  const segments: ProtocolRingSegment[] = protocol.steps.map((step, i) => {
    const startFraction = cursor / total;
    cursor += step.durationSec;
    const endFraction = cursor / total;
    const midHz = interpolateScalar(step.startBeatHz, step.endBeatHz, 0.5, step.curve);
    return {
      stepIndex: i,
      label: step.label,
      startFraction,
      endFraction,
      startBeatHz: step.startBeatHz,
      endBeatHz: step.endBeatHz,
      color: getBandColor(midHz),
    };
  });

  const fadeSec = Math.max(0, Math.round(protocol.fadeOutDurationSec ?? 0));
  if (fadeSec > 0) {
    const tail = lastStep(protocol);
    const hz = tail?.endBeatHz ?? 10;
    segments.push({
      stepIndex: protocol.steps.length,
      label: 'Fade out',
      startFraction: cursor / total,
      endFraction: 1,
      startBeatHz: hz,
      endBeatHz: hz,
      color: 'rgba(255,255,255,0.35)',
    });
  }

  return segments;
}

const DEFAULT_FADE_OUT_SEC = 30;

/** Ensure ids, sane numbers, fade-out defaults, and stopAfterSec === steps + fade. */
export function normalizeProtocol(raw: SessionProtocol): SessionProtocol {
  const steps: ProtocolStep[] = raw.steps.map((s, i) => ({
    id: s.id || `step-${i}`,
    label: s.label || `Step ${i + 1}`,
    durationSec: Math.max(1, Math.round(s.durationSec)),
    startBeatHz: clamp(s.startBeatHz, 0.5, 500),
    endBeatHz: clamp(s.endBeatHz, 0.5, 500),
    curve: s.curve === 'logarithmic' ? 'logarithmic' : 'linear',
    startGain: clamp(s.startGain ?? 0.45, 0.04, 1),
    endGain: clamp(s.endGain ?? s.startGain ?? 0.45, 0.04, 1),
    engineMode: s.engineMode ?? 'binaural',
    ...(isBreathPatternId(s.breathPatternId) ? {breathPatternId: s.breathPatternId} : {}),
  }));

  const last = steps.length > 0 ? steps[steps.length - 1] : null;
  const fadeOutDurationSec = Math.max(0, Math.round(raw.fadeOutDurationSec ?? DEFAULT_FADE_OUT_SEC));
  const fadeOutStartGain = clamp(
    raw.fadeOutStartGain ?? last?.endGain ?? 0.35,
    0,
    1,
  );
  const fadeOutEndGain = clamp(raw.fadeOutEndGain ?? 0.04, 0, 1);

  const normalized: SessionProtocol = {
    ...raw,
    steps,
    fadeOutDurationSec,
    fadeOutStartGain,
    fadeOutEndGain,
    stopAfterPlayback: raw.stopAfterPlayback !== false,
    stopAfterSec: 0,
  };
  normalized.stopAfterSec = computeProtocolTotalSec(normalized);
  return normalized;
}
