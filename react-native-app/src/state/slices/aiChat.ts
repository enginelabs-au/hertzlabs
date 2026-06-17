import type {StateCreator} from 'zustand';
import type {AppStore, EngineMode} from '../types';
import type {SessionProtocol} from '../../protocol/types';
import {pruneCallLog} from '../../ai/aiRateLimit';

/** Optional advanced engine settings the AI Guide may set alongside beat/gain. */
export type GuideAdvancedSettings = {
  /** Carrier / pitch in Hz. */
  carrierHz?: number;
  /** L/R phase offset, 0–360°. */
  phaseAngle?: number;
  /** Per-ear detune (binaural only), −12…+12 Hz. */
  leftDriftHz?: number;
  rightDriftHz?: number;
  /** Stereo pan, −1 (L) … +1 (R). */
  balance?: number;
  /** Ambient noise layer (only one active at a time). */
  noiseLayer?: 'none' | 'white' | 'pink' | 'brown';
  /** Noise mix amount, 0–1. */
  noiseMix?: number;
};

/** Re-applyable configuration captured on an assistant message. */
export type AiApplyPayload =
  | {type: 'guide'; beatHz: number; engineMode: EngineMode; gain: number; advanced?: GuideAdvancedSettings}
  | {type: 'formula'; hz: number}
  | {type: 'protocol'; protocol: SessionProtocol};

export type AiChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  formula?: string;
  apply?: AiApplyPayload;
};

/**
 * In-memory chat transcripts for the two AI modes. Intentionally NOT persisted
 * (excluded from MMKV partialize) so conversations survive tab switches but
 * reset when the app is closed or the user taps Reset.
 */
export type AiChatSlice = {
  guideMessages: AiChatMessage[];
  formulaMessages: AiChatMessage[];
  /** Timestamps (ms) of recent AI submits, for the rolling-window rate limit. Not persisted. */
  aiCallLog: number[];
  appendGuideMessages(messages: AiChatMessage[]): void;
  appendFormulaMessages(messages: AiChatMessage[]): void;
  resetGuideChat(): void;
  resetFormulaChat(): void;
  /** Record an accepted AI submit (prunes the window and appends now). */
  noteAiCall(): void;
};

export const createAiChatSlice: StateCreator<AppStore, [], [], AiChatSlice> = set => ({
  guideMessages: [],
  formulaMessages: [],
  aiCallLog: [],
  appendGuideMessages: messages =>
    set(s => ({guideMessages: [...s.guideMessages, ...messages]})),
  appendFormulaMessages: messages =>
    set(s => ({formulaMessages: [...s.formulaMessages, ...messages]})),
  resetGuideChat: () => set({guideMessages: []}),
  resetFormulaChat: () => set({formulaMessages: []}),
  noteAiCall: () =>
    set(s => {
      const now = Date.now();
      return {aiCallLog: [...pruneCallLog(s.aiCallLog, now), now]};
    }),
});
