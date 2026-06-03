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
  ): void;
  setNoise(type: string, level: number): void;
  fade(toGain: number, durationMs: number): void;
  loadPreset(presetJson: string): void;

  // Phase/timing injection (Plan 03 additive)
  setPhaseAndTiming(phase: number, timingMs: number): void;

  // Events — native → JS
  readonly onEngineState: EventEmitter<{
    state: string;
    sampleRate: number;
    route: string;
  }>;
  readonly onPosition: EventEmitter<{ elapsedSec: number }>;
  readonly onError: EventEmitter<{ code: string; message: string }>;
}

// Use `get` instead of `getEnforcing` so the app doesn't crash in environments
// where the native module hasn't been linked yet (e.g. storybook, Jest, or
// simulators without the Swift package installed).  A null return is handled
// gracefully by HertzAudioClient — each method is a no-op when module is absent.
const _module = TurboModuleRegistry.get<Spec>('HertzAudio');

const noop = () => undefined;
const noopSub = { remove: noop };

// Proxy: real native calls when available, silent no-ops when not.
const NativeHertzAudio: Spec = _module ?? ({
  configure: noop,
  play: noop,
  pause: noop,
  stop: noop,
  setBinauralParameters: noop,
  setNoise: noop,
  fade: noop,
  loadPreset: noop,
  setPhaseAndTiming: noop,
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
