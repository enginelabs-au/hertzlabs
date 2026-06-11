import NativeHertzAudio, {
  type EngineStateEvent,
  type ErrorEvent,
  type PositionEvent,
} from './specs/NativeHertzAudio';
import {
  type BinauralParameters,
  ABS_MIN_BEAT_HZ,
  clampBalance,
  clampGain,
  clampNumber,
  clampRampMs,
  DEFAULT_BEAT_HZ,
  MAX_BEAT_HZ_EXPERIMENTAL,
  MAX_CARRIER_HZ_EXPERIMENTAL,
} from './paramMapping';
import type {NoiseLayers} from '../state/types';
import {noiseLayerGains} from './noiseLayers';

export type NativeSubscription = {
  remove(): void;
};

export const HertzAudioClient = {
  configure(sampleRate: number, bufferDurationMs: number): void {
    NativeHertzAudio.configure(
      clampNumber(sampleRate, 8000, 192000, 48000),
      clampNumber(bufferDurationMs, 1, 100, 5),
    );
  },

  play(): void {
    NativeHertzAudio.play();
  },

  pause(): void {
    NativeHertzAudio.pause();
  },

  stop(): void {
    NativeHertzAudio.stop();
  },

  setBinauralParameters(
    params: BinauralParameters,
    noise?: {layers: NoiseLayers; mix: number},
  ): void {
    // `params` is already tier/experimental-clamped by mapStateToNativeAudio.
    // Re-running sanitizeBinauralParameters here (with its experimental=false
    // default) was re-clamping the carrier to MAX_CARRIER_HZ (1500) — capping
    // Experimental-mode pitch sweeps at 1.5 kHz (and the floor at 20 Hz killed
    // infrasonic sweeps). Apply only wide, context-free safety clamps matching the
    // native ParameterBox range [1e-18, 1e6] so legitimate infrasonic/ultrasonic
    // values pass through untouched; tier/experimental gating already happened.
    const carrierHz = clampNumber(params.carrierHz, ABS_MIN_BEAT_HZ, MAX_CARRIER_HZ_EXPERIMENTAL, 220);
    const beatHz = clampNumber(params.beatHz, ABS_MIN_BEAT_HZ, MAX_BEAT_HZ_EXPERIMENTAL, DEFAULT_BEAT_HZ);
    const g = noise ? noiseLayerGains(noise.layers, noise.mix) : {white: 0, pink: 0, brown: 0};
    NativeHertzAudio.setBinauralParameters(
      carrierHz,
      beatHz,
      clampGain(params.gain),
      clampBalance(params.balance),
      clampGain(g.white),
      clampGain(g.pink),
      clampGain(g.brown),
    );
  },

  setPhaseAndTiming(phaseAngle: number, timingDiffMs: number): void {
    NativeHertzAudio.setPhaseAndTiming(phaseAngle, timingDiffMs);
  },

  setBackgroundPlaybackEnabled(enabled: boolean): void {
    NativeHertzAudio.setBackgroundPlaybackEnabled(enabled);
  },

  setNoise(type: BinauralParameters['noiseType'], level: number): void {
    NativeHertzAudio.setNoise(type, clampGain(level));
  },

  setNoiseLayers(white: number, pink: number, brown: number): void {
    const w = clampGain(white);
    const p = clampGain(pink);
    const b = clampGain(brown);
    if (typeof NativeHertzAudio.setNoiseLayers === 'function') {
      NativeHertzAudio.setNoiseLayers(w, p, b);
      return;
    }
    NativeHertzAudio.setNoise('white', w);
    NativeHertzAudio.setNoise('pink', p);
    NativeHertzAudio.setNoise('brown', b);
  },

  fade(toGain: number, durationMs: number): void {
    NativeHertzAudio.fade(clampGain(toGain), clampRampMs(durationMs));
  },

  loadPreset(preset: unknown): void {
    NativeHertzAudio.loadPreset(JSON.stringify(preset));
  },

  onEngineState(listener: (event: EngineStateEvent) => void): NativeSubscription {
    return NativeHertzAudio.onEngineState(listener);
  },

  onPosition(listener: (event: PositionEvent) => void): NativeSubscription {
    return NativeHertzAudio.onPosition(listener);
  },

  onError(listener: (event: ErrorEvent) => void): NativeSubscription {
    return NativeHertzAudio.onError(listener);
  },
};
