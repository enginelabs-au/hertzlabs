import type {StateCreator} from 'zustand';
import {pushNativeAudioNow} from '../../components/math/applyFormulaEvalToSession';
import {
  computeProtocolTotalSec,
  evaluateProtocolAt,
  normalizeProtocol,
  scaleProtocolStepsToTotalMin,
} from '../../protocol/interpolateProtocol';
import type {ProtocolStep, SessionProtocol} from '../../protocol/types';
import type {AppStore, ProtocolSlice} from '../types';

function applyProtocolEvalNow(get: () => AppStore): void {
  const protocol = get().activeProtocol;
  if (protocol == null || !get().protocolRunning) {
    return;
  }
  const ev = evaluateProtocolAt(protocol, get().elapsedSec, get().gain);
  get().setParam('beatHz', ev.beatHz);
  get().setParam('gain', ev.gain);
  pushNativeAudioNow();
}

export const createProtocolSlice: StateCreator<AppStore, [], [], ProtocolSlice> = (set, get) => ({
  activeProtocol: null,
  protocolRunning: false,
  protocolScrubbing: false,
  protocolStartedAtMs: null,
  protocolDraftSeed: null,
  protocolDraftSeedVersion: 0,

  setProtocolDraftSeed: (protocol: SessionProtocol) => {
    const normalized = normalizeProtocol(protocol);
    set(s => ({
      protocolDraftSeed: normalized,
      protocolDraftSeedVersion: s.protocolDraftSeedVersion + 1,
    }));
  },

  setProtocolScrubbing: (scrubbing: boolean) => {
    set({protocolScrubbing: scrubbing});
  },

  startProtocol: (protocol: SessionProtocol) => {
    const normalized = normalizeProtocol(protocol);
    set(s => ({
      activeProtocol: normalized,
      protocolRunning: true,
      protocolStartedAtMs: Date.now(),
      protocolDraftSeed: normalized,
      protocolDraftSeedVersion: s.protocolDraftSeedVersion + 1,
      elapsedSec: 0,
      elapsedClockEpoch: get().elapsedClockEpoch + 1,
      durationSec: normalized.stopAfterSec,
      isPlaying: true,
      isPaused: false,
    }));
    const ev = evaluateProtocolAt(normalized, 0, get().gain);
    get().setParam('beatHz', ev.beatHz);
    get().setParam('gain', ev.gain);
    pushNativeAudioNow();
  },

  stopProtocol: () => {
    set({activeProtocol: null, protocolRunning: false, protocolScrubbing: false, protocolStartedAtMs: null});
  },

  updateProtocolStep: (stepId: string, patch: Partial<ProtocolStep>) => {
    const cur = get().activeProtocol;
    if (cur == null) {
      return;
    }
    const steps = cur.steps.map(s => (s.id === stepId ? {...s, ...patch} : s));
    const merged = normalizeProtocol({...cur, steps});
    set({activeProtocol: merged, durationSec: merged.stopAfterSec});
    applyProtocolEvalNow(get);
  },

  setProtocolTotalMin: (minutes: number) => {
    const cur = get().activeProtocol;
    if (cur == null) {
      return;
    }
    const steps = scaleProtocolStepsToTotalMin(cur.steps, minutes);
    const merged = normalizeProtocol({...cur, steps});
    set({activeProtocol: merged, durationSec: merged.stopAfterSec});
    applyProtocolEvalNow(get);
  },

  setProtocolAutoStop: (enabled: boolean) => {
    const cur = get().activeProtocol;
    if (cur == null) {
      return;
    }
    set({activeProtocol: {...cur, stopAfterPlayback: enabled}});
  },

  updateProtocolFadeOut: patch => {
    const cur = get().activeProtocol;
    if (cur == null) {
      return;
    }
    const merged = normalizeProtocol({...cur, ...patch});
    set({activeProtocol: merged, durationSec: merged.stopAfterSec});
    applyProtocolEvalNow(get);
  },

  replaceActiveProtocol: (protocol: SessionProtocol) => {
    const normalized = normalizeProtocol(protocol);
    if (!get().protocolRunning) {
      return;
    }
    set({activeProtocol: normalized, durationSec: normalized.stopAfterSec});
    applyProtocolEvalNow(get);
  },

  seekProtocolElapsed: (elapsedSec: number) => {
    const protocol = get().activeProtocol;
    if (protocol == null || !get().protocolRunning) {
      return;
    }
    const total = computeProtocolTotalSec(protocol);
    const clamped = Math.max(0, Math.min(elapsedSec, total));
    set({elapsedSec: clamped});
    applyProtocolEvalNow(get);
  },
});
