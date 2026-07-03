import type {StateCreator} from 'zustand';
import type {GuidedDepthPresetId} from '../../guidedDepth/presets';
import type {AppStore} from '../types';

export type GuidedDepthSlice = {
  guidedDepthEnabled: boolean;
  guidedDepthPresetId: GuidedDepthPresetId;
  setGuidedDepthEnabled(enabled: boolean): void;
  setGuidedDepthPresetId(id: GuidedDepthPresetId): void;
};

export const createGuidedDepthSlice: StateCreator<AppStore, [], [], GuidedDepthSlice> = set => ({
  guidedDepthEnabled: false,
  guidedDepthPresetId: 'theta_unwind',

  setGuidedDepthEnabled(enabled) {
    set({guidedDepthEnabled: enabled});
  },

  setGuidedDepthPresetId(id) {
    set({guidedDepthPresetId: id});
  },
});
