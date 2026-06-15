import {HertzAudioClient} from '../../audio/HertzAudioClient';
import {mapStateToNativeAudio} from '../../audio/engineModeMapping';
import {pushNoiseToNative} from '../../audio/pushNoiseToNative';
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
  const unsubscribeNoiseWhite = store.subscribe(s => s.noiseLayers.white, () => pushNoise());
  const unsubscribeNoisePink = store.subscribe(s => s.noiseLayers.pink, () => pushNoise());
  const unsubscribeNoiseBrown = store.subscribe(s => s.noiseLayers.brown, () => pushNoise());
  const unsubscribeNoiseMix = store.subscribe(s => s.noiseMix, () => pushNoise());
  const unsubscribePhase   = store.subscribe(s => s.phaseAngle,() => pushParams());
  const unsubscribeLeftDrift  = store.subscribe(s => s.leftDriftHz, () => pushParams());
  const unsubscribeRightDrift = store.subscribe(s => s.rightDriftHz, () => pushParams());
  const unsubscribeEngine    = store.subscribe(s => s.engineType, () => pushParams());
  const unsubscribeExperimental = store.subscribe(s => s.experimentalMode, () => pushParams());
  const unsubscribeBreathEnabled = store.subscribe(s => s.breathPacerEnabled, () => pushBreathPacer());
  const unsubscribeBreathPattern = store.subscribe(s => s.breathPatternId, () => pushBreathPacer());
  const unsubscribeBreathDelta = store.subscribe(s => s.breathDeltaDb, () => pushBreathPacer());

  function pushBreathPacer() {
    // Volume modulation runs via store `gain` + breathPacerSync (moves the dial).
    HertzAudioClient.setBreathPacer(false, 0, 0);
  }

  function pushNoise() {
    const s = store.getState();
    pushNoiseToNative(s.noiseLayers, s.noiseMix);
  }

  function pushParams() {
    const s = store.getState();
    const mapped = mapStateToNativeAudio(s);
    HertzAudioClient.setPhaseAndTiming(mapped.phaseAngle, mapped.timingDiffMs);
    HertzAudioClient.setBinauralParameters(mapped, {
      layers: s.noiseLayers,
      mix: s.noiseMix,
    });
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
    unsubscribeBalance();
    unsubscribeNoiseWhite();
    unsubscribeNoisePink();
    unsubscribeNoiseBrown();
    unsubscribeNoiseMix();
    unsubscribePhase(); unsubscribeLeftDrift(); unsubscribeRightDrift();
    unsubscribeEngine(); unsubscribeExperimental();
    unsubscribeBreathEnabled(); unsubscribeBreathPattern(); unsubscribeBreathDelta();
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

  let lastNativePositionMs = 0;
  const positionSub = HertzAudioClient.onPosition(event => {
    if (store.getState().protocolRunning) {
      return;
    }
    lastNativePositionMs = Date.now();
    store.getState().setElapsedSec(event.elapsedSec);
  });

  let playbackSim: ReturnType<typeof setInterval> | null = null;
  let simAnchor = {wallMs: Date.now(), elapsedSec: 0};

  const reanchorPlaybackSim = () => {
    simAnchor = {wallMs: Date.now(), elapsedSec: store.getState().elapsedSec};
  };

  const restartPlaybackSim = () => {
    if (playbackSim != null) {
      clearInterval(playbackSim);
      playbackSim = null;
    }
    if (!store.getState().isPlaying) {
      return;
    }
    reanchorPlaybackSim();
    playbackSim = setInterval(() => {
      if (!store.getState().isPlaying) {
        return;
      }
      const nativeFresh = Date.now() - lastNativePositionMs < 300;
      if (!nativeFresh || store.getState().protocolRunning) {
        const t = simAnchor.elapsedSec + (Date.now() - simAnchor.wallMs) / 1000;
        store.getState().setElapsedSec(t);
      }
    }, 80);
  };

  const unsubscribeProtocolSeek = store.subscribe(s => s.elapsedSec, (elapsed, prev) => {
    if (!store.getState().protocolRunning || !store.getState().isPlaying) {
      return;
    }
    if (prev == null) {
      return;
    }
    const predicted = simAnchor.elapsedSec + (Date.now() - simAnchor.wallMs) / 1000;
    if (Math.abs(elapsed - predicted) > 0.2) {
      reanchorPlaybackSim();
    }
  });

  const unsubscribePlaybackSim = store.subscribe(
    s => ({isPlaying: s.isPlaying, epoch: s.elapsedClockEpoch}),
    ({isPlaying}) => {
      restartPlaybackSim();
      if (!isPlaying && playbackSim != null) {
        clearInterval(playbackSim);
        playbackSim = null;
      }
    },
  );

  const errorSub = HertzAudioClient.onError(event => {
    store.getState()._ingestNativeError(`${event.code}: ${event.message}`);
  });

  // Prime native DSP before first play (subscriptions only fire on change).
  pushParams();
  pushBreathPacer();

  return () => {
    installed = false;
    unsubscribeParams();
    unsubscribePlayback();
    unsubscribePlaybackSim();
    unsubscribeProtocolSeek();
    if (playbackSim != null) {
      clearInterval(playbackSim);
    }
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
