import {useHertzStore} from '../state/store';
import type {GuidedDepthPresetId} from './presets';
import {guidedDepthPreset} from './presets';

/** Apply a guided depth preset to live session params (beat, breath, script id). */
export function applyGuidedDepthPreset(presetId: GuidedDepthPresetId): void {
  const preset = guidedDepthPreset(presetId);
  const store = useHertzStore.getState();
  store.setParam('beatHz', preset.beatHz);
  store.setBreathPatternId(preset.breathPatternId);
  store.setBreathDeltaDb(preset.breathDeltaDb);
  store.setBreathPacerEnabled(true);
  store.setGuidedDepthPresetId(presetId);
  store.setGuidedDepthEnabled(true);
}
