// @ts-nocheck — TelemetrySlice not yet composed into AppStore (telemetry-js-wiring blocker)
import type { StateCreator } from 'zustand';
import type { AppStore } from '../types';

export interface TelemetryState {
  sensorActive: boolean;
  gyroY: number;
  accelMagnitude: number;
  attitude: { roll: number; pitch: number; yaw: number };
  heading: number;
  stepCadence: number;
  shakeDetected: boolean;
  lastMotionTimestamp: number;
}

export interface TelemetryActions {
  _ingestTelemetry(data: Partial<TelemetryState>): void;
  setSensorActive(active: boolean): void;
}

export type TelemetrySlice = TelemetryState & TelemetryActions;

const initialTelemetryState: TelemetryState = {
  sensorActive: false,
  gyroY: 0.5,
  accelMagnitude: 0,
  attitude: { roll: 0.5, pitch: 0.5, yaw: 0 },
  heading: 0,
  stepCadence: 0,
  shakeDetected: false,
  lastMotionTimestamp: 0,
};

export const createTelemetrySlice: StateCreator<
  AppStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  TelemetrySlice
> = (set) => ({
  ...initialTelemetryState,

  _ingestTelemetry(data) {
    set((state) => {
      const next = { ...state, ...data, lastMotionTimestamp: Date.now() };
      // Auto-reset shakeDetected after 1 second
      if (data.shakeDetected === true) {
        setTimeout(() => {
          set({ shakeDetected: false });
        }, 1000);
      }
      return next;
    });
  },

  setSensorActive(active) {
    set({ sensorActive: active });
  },
});
