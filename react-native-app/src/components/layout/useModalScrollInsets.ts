import {useSafeAreaInsets} from 'react-native-safe-area-context';

/** Bottom padding for modal ScrollViews so content clears the system nav bar. */
export function useModalScrollInsets(extraPad = 28): {paddingBottom: number} {
  const {bottom} = useSafeAreaInsets();
  return {paddingBottom: Math.max(bottom, 12) + extraPad};
}
