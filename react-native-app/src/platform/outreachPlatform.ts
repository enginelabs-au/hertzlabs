import {Platform} from 'react-native';
import {isMacDesktopBuild} from './layoutProfile';

/** Device platform for outreach reward code allocation (ios | android | macos). */
export type OutreachDevicePlatform = 'ios' | 'android' | 'macos';

export function outreachDevicePlatform(): OutreachDevicePlatform {
  if (Platform.OS === 'android') {
    return 'android';
  }
  if (isMacDesktopBuild()) {
    return 'macos';
  }
  return 'ios';
}
