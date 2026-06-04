import NativeHertzAudio, {
  type EngineStateEvent,
  type ErrorEvent,
  type PositionEvent,
} from './specs/NativeHertzAudio';
import {
  type BinauralParameters,
  sanitizeBinauralParameters,
  clampGain,
  clampNumber,
  clampRampMs,
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
    const safe = sanitizeBinauralParameters(params);
    const g = noise ? noiseLayerGains(noise.layers, noise.mix) : {white: 0, pink: 0, brown: 0};
    NativeHertzAudio.setBinauralParameters(
      safe.carrierHz,
      safe.beatHz,
      safe.gain,
      safe.balance,
      clampGain(g.white),
      clampGain(g.pink),
      clampGain(g.brown),
    );
  },

  setPhaseAndTiming(phaseAngle: number, timingDiffMs: number): void {
    NativeHertzAudio.setPhaseAndTiming(phaseAngle, timingDiffMs);
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
