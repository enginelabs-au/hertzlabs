/**
 * Android requires `onBackgroundEvent` at the JS entry (index.js), outside React.
 * Modal routing on tap uses getInitialNotification + onForegroundEvent in useStreakNotificationPress.
 */
import notifee, {EventType} from '@notifee/react-native';

notifee.onBackgroundEvent(async ({type}) => {
  if (type === EventType.PRESS) {
    // Handled when the app becomes active (getInitialNotification / foreground listener).
  }
});

export function registerNotifeeBackgroundHandler(): void {
  /* Side effect above runs on import. */
}
