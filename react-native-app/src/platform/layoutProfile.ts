import {Platform, useWindowDimensions} from 'react-native';

/** Mac App Store screenshot / window target (16:10). */
export const MAC_TARGET_ASPECT = 16 / 10;

/** Minimum width before we treat the window as Mac desktop layout. */
export const MAC_WIDE_MIN_WIDTH = 640;

/** True only on native Mac Catalyst builds — never on iPhone or iPad. */
export function isMacDesktopBuild(): boolean {
  return Platform.OS === 'ios' && Platform.isMacCatalyst === true;
}

/**
 * Layout profile for Mac Catalyst desktop vs phone/iPad.
 * iPhone builds are unchanged: isMacWide is always false on device.
 */
export function useLayoutProfile() {
  const {width, height, fontScale} = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isLandscape = width > height;
  const isMacWide =
    isMacDesktopBuild() && isLandscape && longSide >= MAC_WIDE_MIN_WIDTH;
  const aspectRatio = width / Math.max(height, 1);
  const contentMaxWidth = width;

  return {
    width,
    height,
    fontScale,
    shortSide,
    longSide,
    isLandscape,
    isMacWide,
    isMacDesktop: isMacDesktopBuild(),
    aspectRatio,
    contentMaxWidth,
  };
}
