import {useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {usePostHog} from 'posthog-react-native';
import {useHertzStore} from '../state/store';
import {localDateIso} from '../promos/streakEngagement';
import {requestStreakNotificationPermission} from '../notifications/streakNotifications';

const QUALIFYING_SEC = 120;

/**
 * Once, after the first day with 2 minutes of playback, offer evening streak reminders.
 * The Promos toggle remains the place to change the choice later.
 */
export function useStreakReminderPrompt(enabled: boolean): void {
  const posthog = usePostHog();
  const streakRemindersEnabled = useHertzStore(s => s.streakRemindersEnabled);
  const streakRemindersPromptShown = useHertzStore(s => s.streakRemindersPromptShown);
  const lastQualifyingDate = useHertzStore(s => s.lastQualifyingDate);
  const todayQualifyingPlaybackSec = useHertzStore(s => s.todayQualifyingPlaybackSec);
  const todayQualifyingBucketDate = useHertzStore(s => s.todayQualifyingBucketDate);
  const activeModal = useHertzStore(s => s.activeModal);
  const offering = useRef(false);

  const todayIso = localDateIso();
  const bucketToday = todayQualifyingBucketDate === todayIso ? todayQualifyingPlaybackSec : 0;
  const qualifiedToday =
    lastQualifyingDate === todayIso || bucketToday >= QUALIFYING_SEC;

  useEffect(() => {
    if (
      !enabled ||
      !qualifiedToday ||
      streakRemindersEnabled ||
      streakRemindersPromptShown ||
      activeModal != null ||
      offering.current
    ) {
      return;
    }

    offering.current = true;
    const updateSettings = useHertzStore.getState().updateSettings;
    updateSettings({streakRemindersPromptShown: true});

    Alert.alert(
      'Keep your streak alive?',
      'Get a quiet evening reminder if you have not yet played for 2 minutes today. You can change this any time on the Promos screen.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            posthog?.capture('streak reminders toggled', {
              enabled: false,
              source: 'first_session_prompt',
            });
            offering.current = false;
          },
        },
        {
          text: 'Turn on reminders',
          onPress: () => {
            void (async () => {
              const granted = await requestStreakNotificationPermission();
              if (granted) {
                updateSettings({streakRemindersEnabled: true});
                posthog?.capture('streak reminders toggled', {
                  enabled: true,
                  source: 'first_session_prompt',
                });
              } else {
                posthog?.capture('streak reminders toggled', {
                  enabled: false,
                  source: 'first_session_prompt_denied',
                });
              }
              offering.current = false;
            })();
          },
        },
      ],
    );
  }, [
    enabled,
    qualifiedToday,
    streakRemindersEnabled,
    streakRemindersPromptShown,
    activeModal,
    posthog,
  ]);
}
