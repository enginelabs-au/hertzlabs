import {useEffect, useRef} from 'react';
import {usePostHog} from 'posthog-react-native';
import {useHertzStore} from '../state/store';
import {localDateIso} from '../promos/streakEngagement';

/**
 * First-session product events for PostHog: when playback starts this cold start,
 * and when today first reaches 2 minutes of qualifying playback.
 */
export function usePlaybackAnalytics(enabled: boolean): void {
  const posthog = usePostHog();
  const isPlaying = useHertzStore(s => s.isPlaying);
  const lastQualifyingDate = useHertzStore(s => s.lastQualifyingDate);
  const startedThisLaunch = useRef(false);
  const lastQualifiedSent = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !isPlaying || startedThisLaunch.current) {
      return;
    }
    startedThisLaunch.current = true;
    posthog?.capture('playback started');
  }, [enabled, isPlaying, posthog]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const today = localDateIso();
    if (lastQualifyingDate !== today || lastQualifiedSent.current === today) {
      return;
    }
    lastQualifiedSent.current = today;
    posthog?.capture('session qualified');
  }, [enabled, lastQualifyingDate, posthog]);
}
