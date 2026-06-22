import {Platform} from 'react-native';
import {isMacDesktopBuild} from '../platform/layoutProfile';

/** Canonical outreach platform sent to backend (ios | android | macos). */
export type OutreachPlatform = 'ios' | 'android' | 'macos';

export function getOutreachPlatform(): OutreachPlatform {
  if (Platform.OS === 'android') {
    return 'android';
  }
  if (isMacDesktopBuild()) {
    return 'macos';
  }
  return 'ios';
}
