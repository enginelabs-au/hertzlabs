/**
 * Codegen TurboModule spec for HertzAudio native module.
 * Both platforms (iOS Swift bridge + Android Kotlin/JNI) implement this contract.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  // Lifecycle
  configure(sampleRate: number, bufferDurationMs: number): void;
  play(): void;
  pause(): void;
  stop(): void;

  // DSP parameters — all targets are validated/clamped natively before render
  setBinauralParameters(
    carrierHz: number,
    beatHz: number,
    gain: number,
    balance: number,
    noiseWhite: number,
    noisePink: number,
    noiseBrown: number,
  ): void;
  setNoise(type: string, level: number): void;
  setNoiseLayers(white: number, pink: number, brown: number): void;
  fade(toGain: number, durationMs: number): void;
  loadPreset(presetJson: string): void;

  // Phase/timing injection (Plan 03 additive)
  setPhaseAndTiming(phase: number, timingMs: number): void;
  setBackgroundPlaybackEnabled(enabled: boolean): void;
  setBreathPacer(enabled: boolean, patternId: number, deltaDb: number): void;

  // Events — native → JS
  readonly onEngineState: EventEmitter<{
    state: string;
    sampleRate: number;
    route: string;
  }>;
  readonly onPosition: EventEmitter<{ elapsedSec: number }>;
  readonly onError: EventEmitter<{ code: string; message: string }>;
}

function isVitestRuntime(): boolean {
  const proc = (globalThis as {process?: {env?: {VITEST?: string}}}).process;
  return proc?.env?.VITEST != null;
}

const _module = isVitestRuntime() ? null : TurboModuleRegistry.get<Spec>('HertzAudio');

const noop = () => undefined;
const noopSub = { remove: noop };

const NativeHertzAudio: Spec = _module ?? ({
  configure: noop,
  play: noop,
  pause: noop,
  stop: noop,
  setBinauralParameters: noop,
  setNoise: noop,
  setNoiseLayers: noop,
  fade: noop,
  loadPreset: noop,
  setPhaseAndTiming: noop,
  setBackgroundPlaybackEnabled: noop,
  setBreathPacer: noop,
  onEngineState: (_l: unknown) => noopSub,
  onPosition: (_l: unknown) => noopSub,
  onError: (_l: unknown) => noopSub,
} as unknown as Spec);

export default NativeHertzAudio;

// Event payload type aliases consumed by HertzAudioClient.ts
export type EngineStateEvent = {
  state: string;
  sampleRate: number;
  route: string;
  bufferDurationMs?: number;
  measuredLatencyMs?: number;
  highVolumeWarningTriggered?: boolean;
  isStereoRoute?: boolean;
  lastSafetyEvent?: string | null;
};
export type PositionEvent = { elapsedSec: number };
export type ErrorEvent = { code: string; message: string };
