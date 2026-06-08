/**
 * Codegen TurboModule spec for HertzTelemetry native module.
 * iOS: thin Objective-C TurboModule wrapping CoreMotion.
 */
import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
import type {EventEmitter} from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  startSensors(intervalMs: number): void;
  stopSensors(): void;

  readonly onTelemetryUpdate: EventEmitter<{
    gyroX: number;
    gyroY: number;
    gyroZ: number;
    accelX: number;
    accelY: number;
    accelZ: number;
    roll: number;
    pitch: number;
    yaw: number;
    heading: number;
    cadenceBpm: number;
    shakeDetected: boolean;
  }>;
  readonly onTelemetrySleep: EventEmitter<void>;
}

function isVitestRuntime(): boolean {
  const proc = (globalThis as {process?: {env?: {VITEST?: string}}}).process;
  return proc?.env?.VITEST != null;
}

const _module = isVitestRuntime() ? null : TurboModuleRegistry.get<Spec>('HertzTelemetry');

const noop = () => undefined;
const noopSub = {remove: noop};

const NativeHertzTelemetry: Spec =
  _module ??
  ({
    startSensors: noop,
    stopSensors: noop,
    onTelemetryUpdate: (_l: unknown) => noopSub,
    onTelemetrySleep: (_l: unknown) => noopSub,
  } as unknown as Spec);

export default NativeHertzTelemetry;

export type TelemetryUpdateEvent = {
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  accelMagnitude: number;
  roll: number;
  pitch: number;
  yaw: number;
  heading: number;
  cadenceBpm: number;
  stepCadence: number;
  shakeDetected: boolean;
  sensorActive: boolean;
};
