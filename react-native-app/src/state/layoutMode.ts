import {useHertzStore} from '../state/store';

/** Read layout mode from global store — free for all tiers. */
export function useLayoutMode() {
  const isAdvancedMode = useHertzStore(s => s.isAdvancedMode);
  const toggleAdvancedMode = useHertzStore(s => s.toggleAdvancedMode);
  return {isAdvancedMode, toggleAdvancedMode};
}

export {useHertzStore};
