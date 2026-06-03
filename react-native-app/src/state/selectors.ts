import {getStereoFrequencies} from '../audio/paramMapping';
import {useHertzStore} from './store';

export const useCarrierHz = () => useHertzStore(state => state.carrierHz);
export const useBeatHz = () => useHertzStore(state => state.beatHz);
export const useGain = () => useHertzStore(state => state.gain);
export const useBalance = () => useHertzStore(state => state.balance);
export const useEngineState = () => useHertzStore(state => state.state);
export const useOutputRoute = () => useHertzStore(state => state.outputRoute);
export const useIsPremium = () => useHertzStore(state => state.tier === 'premium');
export const useHighVolumeWarning = () => useHertzStore(state => state.highVolumeWarningTriggered);

export const selectStereoFrequencies = () => {
  const carrierHz = useHertzStore.getState().carrierHz;
  const beatHz = useHertzStore.getState().beatHz;
  return getStereoFrequencies(carrierHz, beatHz);
};
