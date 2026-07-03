import type {StateCreator} from 'zustand';
import {clampStemMix, DEFAULT_ASMR_STEM_MIX, type AsmrStemId, type AsmrStemMix} from '../../audio/asmrStems';
import {pushCombinedNoiseToNative} from '../../audio/pushNoiseToNative';
import type {AppStore} from '../types';

export type AsmrSlice = {
  asmrEnabled: boolean;
  asmrStemMix: AsmrStemMix;
  setAsmrEnabled(enabled: boolean): void;
  setAsmrStemMix(stem: AsmrStemId, mix: number): void;
  resetAsmrStemMix(): void;
};

function pushAsmrNoise(state: AppStore): void {
  pushCombinedNoiseToNative({
    ambientLayers: state.noiseLayers,
    ambientMix: state.noiseMix,
    asmrEnabled: state.asmrEnabled,
    asmrMix: state.asmrStemMix,
  });
}

export const createAsmrSlice: StateCreator<AppStore, [], [], AsmrSlice> = (set, get) => ({
  asmrEnabled: false,
  asmrStemMix: {...DEFAULT_ASMR_STEM_MIX},

  setAsmrEnabled(enabled) {
    set({asmrEnabled: enabled});
    pushAsmrNoise(get());
  },

  setAsmrStemMix(stem, mix) {
    set(s => ({
      asmrStemMix: {...s.asmrStemMix, [stem]: clampStemMix(mix)},
      asmrEnabled: s.asmrEnabled || clampStemMix(mix) > 0,
    }));
    pushAsmrNoise(get());
  },

  resetAsmrStemMix() {
    set({asmrStemMix: {...DEFAULT_ASMR_STEM_MIX}, asmrEnabled: false});
    pushAsmrNoise(get());
  },
});
