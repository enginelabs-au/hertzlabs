import {HertzAudioClient} from '../../audio/HertzAudioClient';
import {mapStateToNativeAudio} from '../../audio/engineModeMapping';
import type {AppStore, EngineState, OutputRoute} from '../types';

let installed = false;

type SelectorStore = {
  getState(): AppStore;
  subscribe<T>(
    selector: (state: AppStore) => T,
    listener: (selected: T, previous: T) => void,
  ): () => void;
};

export function installAudioSync(store: SelectorStore): () => void {
  if (installed) {
    return () => undefined;
  }
  installed = true;

  // Subscribe to individual primitive fields so subscribeWithSelector's
  // strict equality check actually fires only on real changes.
  // Returning a new object literal from a selector always looks "changed",
  // which causes an infinite loop when the listener writes back to the store.
  const unsubscribeCarrier = store.subscribe(s => s.carrierHz, () => pushParams());
  const unsubscribeBeat    = store.subscribe(s => s.beatHz,    () => pushParams());
  const unsubscribeGain    = store.subscribe(s => s.gain,      () => pushParams());
  const unsubscribeBalance = store.subscribe(s => s.balance,   () => pushParams());
  const unsubscribeNoise   = store.subscribe(s => s.noiseType, () => pushParams());
  const unsubscribeNoiseLv = store.subscribe(s => s.noiseLevel,() => pushParams());
  const unsubscribePhase   = store.subscribe(s => s.phaseAngle,() => pushParams());
  const unsubscribeTiming  = store.subscribe(s => s.timingDiffMs, () => pushParams());
  const unsubscribeEngine    = store.subscribe(s => s.engineType, () => pushParams());

  function pushParams() {
    const mapped = mapStateToNativeAudio(store.getState());
    HertzAudioClient.setBinauralParameters(mapped);
    HertzAudioClient.setPhaseAndTiming(mapped.phaseAngle, mapped.timingDiffMs);
  }

  const unsubscribeIsPlaying = store.subscribe(
    s => s.isPlaying,
    isPlaying => {
      if (isPlaying) {
        pushParams();
        HertzAudioClient.play();
      } else {
        HertzAudioClient.pause();
      }
    },
  );

  const unsubscribeIsPaused = store.subscribe(
    s => s.isPaused,
    isPaused => {
      if (isPaused) { HertzAudioClient.pause(); }
    },
  );

  // Proxy: combine all param-level unsubscribers
  const unsubscribeParams = () => {
    unsubscribeCarrier(); unsubscribeBeat(); unsubscribeGain();
    unsubscribeBalance(); unsubscribeNoise(); unsubscribeNoiseLv();
    unsubscribePhase(); unsubscribeTiming();
    unsubscribeEngine();
  };
  const unsubscribePlayback = () => {
    unsubscribeIsPlaying(); unsubscribeIsPaused();
  };

  const engineSub = HertzAudioClient.onEngineState(event => {
    store.getState()._ingestNativeState({
      state: mapEngineState(event.state),
      sampleRate: event.sampleRate,
      bufferDurationMs: event.bufferDurationMs ?? store.getState().bufferDurationMs,
      outputRoute: mapOutputRoute(event.route),
      measuredLatencyMs: event.measuredLatencyMs ?? store.getState().measuredLatencyMs,
      highVolumeWarningTriggered: event.highVolumeWarningTriggered ?? store.getState().highVolumeWarningTriggered,
      isStereoRoute: event.isStereoRoute ?? store.getState().isStereoRoute,
      lastSafetyEvent: event.lastSafetyEvent ?? store.getState().lastSafetyEvent,
    });
  });

  const positionSub = HertzAudioClient.onPosition(event => {
    store.getState().setElapsedSec(event.elapsedSec);
  });

  const errorSub = HertzAudioClient.onError(event => {
    store.getState()._ingestNativeError(`${event.code}: ${event.message}`);
  });

  // Prime native DSP before first play (subscriptions only fire on change).
  pushParams();

  return () => {
    installed = false;
    unsubscribeParams();
    unsubscribePlayback();
    engineSub.remove();
    positionSub.remove();
    errorSub.remove();
  };
}

function mapEngineState(state: string): EngineState {
  if (state === 'playing' || state === 'ready' || state === 'paused' || state === 'interrupted' || state === 'error') {
    return state;
  }
  if (state === 'stopped') {
    return 'paused';
  }
  return 'uninitialized';
}

function mapOutputRoute(route: string): OutputRoute {
  if (route === 'speaker' || route === 'headphones' || route === 'bluetooth' || route === 'airplay') {
    return route;
  }
  return 'unknown';
}
