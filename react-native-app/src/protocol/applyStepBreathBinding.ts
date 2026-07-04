import type {BreathPatternId} from '../breathPacer/patterns';
import type {AppStore} from '../state/types';
import type {ProtocolStep} from './types';

type BreathBindingStore = Pick<
  AppStore,
  'breathPacerEnabled' | 'breathPatternId' | 'setBreathPatternId' | 'setBreathPacerEnabled'
>;

/** Apply a step's optional breath pattern (enables overlay + resets phase clock). */
export function applyStepBreathBinding(store: BreathBindingStore, step: ProtocolStep | undefined): void {
  const patternId = step?.breathPatternId;
  if (patternId == null) {
    return;
  }
  if (!store.breathPacerEnabled) {
    store.setBreathPacerEnabled(true);
  }
  if (store.breathPatternId !== patternId) {
    store.setBreathPatternId(patternId);
  }
}

/** Suggest a breath pattern from average beat Hz (for presets / AI). */
export function suggestBreathPatternForHz(avgHz: number): BreathPatternId {
  if (avgHz <= 4) {
    return '478';
  }
  if (avgHz <= 8) {
    return 'resonant';
  }
  if (avgHz <= 14) {
    return 'box';
  }
  return 'box';
}

export function suggestBreathPatternForStep(
  step: Pick<ProtocolStep, 'startBeatHz' | 'endBeatHz'>,
): BreathPatternId {
  return suggestBreathPatternForHz((step.startBeatHz + step.endBeatHz) / 2);
}
