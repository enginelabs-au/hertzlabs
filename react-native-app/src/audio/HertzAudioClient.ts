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

  setBinauralParameters(params: BinauralParameters): void {
    const safe = sanitizeBinauralParameters(params);
    NativeHertzAudio.setBinauralParameters(safe.carrierHz, safe.beatHz, safe.gain, safe.balance);
    NativeHertzAudio.setNoise(safe.noiseType, safe.noiseLevel);
  },

  setNoise(type: BinauralParameters['noiseType'], level: number): void {
    NativeHertzAudio.setNoise(type, clampGain(level));
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
