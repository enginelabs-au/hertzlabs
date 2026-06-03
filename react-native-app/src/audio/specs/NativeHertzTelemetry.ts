/**
 * Codegen TurboModule spec for HertzTelemetry native module.
 * iOS: thin Objective-C TurboModule wrapping the Swift Telemetry pipeline.
 * Android: deferred (spec is platform-agnostic).
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  startSensors(intervalMs: number): void;
  stopSensors(): void;

  // Events — native → JS
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

export default TurboModuleRegistry.getEnforcing<Spec>('HertzTelemetry');

// Event payload type alias consumed by useTelemetrySync.ts
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
