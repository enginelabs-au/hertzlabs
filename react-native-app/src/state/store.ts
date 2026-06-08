import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {createAISlice} from './slices/ai';
import {createAudioParamsSlice} from './slices/audioParams';
import {createEngineSlice} from './slices/engine';
import {createPresetSlice} from './slices/preset';
import {createSessionSlice} from './slices/session';
import {createSettingsSlice} from './slices/settings';
import {createSubscriptionSlice} from './slices/subscription';
import {createTelemetrySlice} from './slices/telemetry';
import {createUiSlice} from './slices/ui';
import {persist, persistedStoreOptions} from './middleware/persist';
import type {AppStore} from './types';

export const useHertzStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      (...args) => ({
        ...createAudioParamsSlice(...args),
        ...createSessionSlice(...args),
        ...createEngineSlice(...args),
        ...createPresetSlice(...args),
        ...createAISlice(...args),
        ...createUiSlice(...args),
        ...createSettingsSlice(...args),
        ...createSubscriptionSlice(...args),
        ...createTelemetrySlice(...args),
      }),
      persistedStoreOptions,
    ),
  ),
);

export type HertzStore = typeof useHertzStore;
