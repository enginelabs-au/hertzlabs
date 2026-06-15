import type {StateCreator} from 'zustand';
import type {AppStore, EngineMode} from '../types';
import type {SessionProtocol} from '../../protocol/types';

/** Re-applyable configuration captured on an assistant message. */
export type AiApplyPayload =
  | {type: 'guide'; beatHz: number; engineMode: EngineMode; gain: number}
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
  appendGuideMessages(messages: AiChatMessage[]): void;
  appendFormulaMessages(messages: AiChatMessage[]): void;
  resetGuideChat(): void;
  resetFormulaChat(): void;
};

export const createAiChatSlice: StateCreator<AppStore, [], [], AiChatSlice> = set => ({
  guideMessages: [],
  formulaMessages: [],
  appendGuideMessages: messages =>
    set(s => ({guideMessages: [...s.guideMessages, ...messages]})),
  appendFormulaMessages: messages =>
    set(s => ({formulaMessages: [...s.formulaMessages, ...messages]})),
  resetGuideChat: () => set({guideMessages: []}),
  resetFormulaChat: () => set({formulaMessages: []}),
});
