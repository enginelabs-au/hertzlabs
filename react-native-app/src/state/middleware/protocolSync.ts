import {pushNativeAudioNow} from '../../components/math/applyFormulaEvalToSession';
import {applyStepBreathBinding} from '../../protocol/applyStepBreathBinding';
import {evaluateProtocolAt} from '../../protocol/interpolateProtocol';
import type {AppStore} from '../types';

type StoreApi = {
  getState: () => AppStore;
  subscribe: <T>(
    selector: (state: AppStore) => T,
    listener: (selected: T, previous: T) => void,
    options?: {equalityFn?: (a: T, b: T) => boolean; fireImmediately?: boolean},
  ) => () => void;
};

const TICK_MS = 100;

/**
 * Drives the live frequency journey while a protocol is running. It is a pure
 * function of the shared `elapsedSec` clock (which audioSync keeps pause-safe
 * from the native playback position), so there is exactly one time source — the
 * same one the ProtocolRing reads. On each tick it writes beat/gain/engine via
 * `setParam`, which propagates to native audio AND the dial shared values
 * (slider + oscilloscope). Mounted once at app root.
 */
export function installProtocolSync(store: StoreApi): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastBeatHz: number | null = null;
  let lastGain: number | null = null;
  let lastStepIndex: number | null = null;

  const reset = () => {
    lastBeatHz = null;
    lastGain = null;
    lastStepIndex = null;
  };

  const applyBreathForStepIndex = (state: AppStore, stepIndex: number) => {
    const protocol = state.activeProtocol;
    if (protocol == null) {
      return;
    }
    applyStepBreathBinding(state, protocol.steps[stepIndex]);
  };

  const tick = () => {
    const state = store.getState();
    const protocol = state.activeProtocol;
    if (!state.protocolRunning || protocol == null || !state.isPlaying || state.protocolScrubbing) {
      return;
    }

    const ev = evaluateProtocolAt(protocol, state.elapsedSec, state.gain);

    if (ev.stepIndex !== lastStepIndex) {
      lastStepIndex = ev.stepIndex;
      applyBreathForStepIndex(state, ev.stepIndex);
    }

    if (ev.isComplete && protocol.stopAfterPlayback) {
      state.setParam('beatHz', ev.beatHz);
      state.setParam('gain', ev.gain);
      pushNativeAudioNow();
      state.requestPause();
      state.stopProtocol();
      reset();
      return;
    }

    const beatChanged = lastBeatHz == null || Math.abs(ev.beatHz - lastBeatHz) >= 0.01;
    const gainChanged = lastGain == null || Math.abs(ev.gain - lastGain) >= 0.004;

    if (beatChanged) {
      state.setParam('beatHz', ev.beatHz);
      lastBeatHz = ev.beatHz;
    }
    if (gainChanged) {
      if (state.breathPacerEnabled) {
        state.setBreathGainAnchor(ev.gain);
      } else {
        state.setParam('gain', ev.gain);
      }
      lastGain = ev.gain;
    }
    if (beatChanged || gainChanged) {
      pushNativeAudioNow();
    }
  };

  const startLoop = () => {
    if (intervalId == null) {
      intervalId = setInterval(tick, TICK_MS);
    }
  };
  const stopLoop = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const unsubscribe = store.subscribe(
    s => s.protocolRunning,
    running => {
      if (running) {
        reset();
        startLoop();
        tick();
      } else {
        stopLoop();
        reset();
      }
    },
    {fireImmediately: true},
  );

  return () => {
    unsubscribe();
    stopLoop();
    reset();
  };
}
