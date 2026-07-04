import {useEffect} from 'react';
import {useHertzStore} from '../state/store';

/**
 * Opens Promos or streak-restore modal when user taps a local Notifee notification.
 */
export function useStreakNotificationPress(hydrated: boolean): void {
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    let unsubForeground: (() => void) | undefined;

    void (async () => {
      try {
        const mod = await import('@notifee/react-native');
        const notifee = mod.default;
        const {EventType} = mod;

        const handlePress = (campaign: unknown) => {
          if (campaign === 'streak_restore') {
            setActiveModal('streakRestore');
            return;
          }
          if (campaign === 'streak_daily') {
            setActiveModal('promos');
          }
        };

        unsubForeground = notifee.onForegroundEvent(({type, detail}) => {
          if (type === EventType.PRESS) {
            handlePress(detail.notification?.data?.campaign);
          }
        });

        const initial = await notifee.getInitialNotification();
        if (initial?.notification?.data?.campaign != null) {
          handlePress(initial.notification.data.campaign);
        }
      } catch {
        if (__DEV__) {
          console.warn('[useStreakNotificationPress] Notifee not linked.');
        }
      }
    })();

    return () => {
      unsubForeground?.();
    };
  }, [hydrated, setActiveModal]);
}
