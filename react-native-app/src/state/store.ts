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
import {createBreathPacerSlice} from './slices/breathPacer';
import {createProtocolSlice} from './slices/protocol';
import {createAiChatSlice} from './slices/aiChat';
import {createLayoutModeSlice} from './slices/layoutMode';
import {createUiSlice} from './slices/ui';
import {createGrowthSlice} from './slices/growth';
import {createPromoSlice} from './slices/promo';
import {createGuidedDepthSlice} from './slices/guidedDepth';
import {createAsmrSlice} from './slices/asmr';
import {createFocusChallengeSlice} from './slices/focusChallenge';
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
        ...createLayoutModeSlice(...args),
        ...createSettingsSlice(...args),
        ...createSubscriptionSlice(...args),
        ...createTelemetrySlice(...args),
        ...createProtocolSlice(...args),
        ...createBreathPacerSlice(...args),
        ...createAiChatSlice(...args),
        ...createGrowthSlice(...args),
        ...createPromoSlice(...args),
        ...createGuidedDepthSlice(...args),
        ...createAsmrSlice(...args),
        ...createFocusChallengeSlice(...args),
      }),
      persistedStoreOptions,
    ),
  ),
);

export type HertzStore = typeof useHertzStore;
