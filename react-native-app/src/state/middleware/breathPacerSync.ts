import {clampGain} from '../../audio/paramMapping';
import {breathGainMultiplierAt, modulatedBreathGain} from '../../breathPacer/breathEnvelope';
import type {AppStore} from '../types';

type StoreApi = {
  getState: () => AppStore;
  setState: (partial: Partial<AppStore>) => void;
  subscribe: <T>(
    selector: (state: AppStore) => T,
    listener: (selected: T, previous: T) => void,
    options?: {fireImmediately?: boolean},
  ) => () => void;
};

const TICK_MS = 50;

/**
 * Drives the main VOLUME dial + native gain from the breath pattern clock.
 * Uses breathGainAnchor as the user's center volume; live gain = anchor × envelope.
 */
export function installBreathPacerSync(store: StoreApi): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    const state = store.getState();
    if (!state.breathPacerEnabled || !state.isPlaying || state.isPaused) {
      return;
    }
    if (state.breathClockStartedAtMs == null) {
      return;
    }

    const mult = breathGainMultiplierAt(
      state.breathPatternId,
      state.breathDeltaDb,
      state.breathClockStartedAtMs,
    );
    const targetGain = modulatedBreathGain(state.breathGainAnchor, mult);
    if (Math.abs(targetGain - state.gain) < 0.002) {
      return;
    }

    store.setState({gain: clampGain(targetGain)});
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

  const syncLoop = () => {
    const s = store.getState();
    if (s.breathPacerEnabled && s.isPlaying && !s.isPaused) {
      startLoop();
      tick();
    } else {
      stopLoop();
    }
  };

  const unsubBreath = store.subscribe(s => s.breathPacerEnabled, syncLoop);
  const unsubPlaying = store.subscribe(s => s.isPlaying, syncLoop);
  const unsubPaused = store.subscribe(s => s.isPaused, syncLoop);
  const unsubPattern = store.subscribe(s => s.breathPatternId, () => {
    const s = store.getState();
    if (s.breathPacerEnabled) {
      store.setState({breathClockStartedAtMs: Date.now()});
      tick();
    }
  });
  const unsubDelta = store.subscribe(s => s.breathDeltaDb, () => tick());

  syncLoop();

  return () => {
    unsubBreath();
    unsubPlaying();
    unsubPaused();
    unsubPattern();
    unsubDelta();
    stopLoop();
  };
}
