import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {HertzAudioClient} from '../audio/HertzAudioClient';
import {useHertzStore} from '../state/store';
import {isPremiumUnlocked} from '../monetization/isPremiumUnlocked';

function syncNativeBackgroundPlayback(enabled: boolean): void {
  HertzAudioClient.setBackgroundPlaybackEnabled(enabled);
}

function stopAudioEngine(): void {
  HertzAudioClient.pause();
  useHertzStore.getState().requestPause();
}

/**
 * Manages audio background behaviour based on subscription tier.
 *
 * Premium + toggle on: keeps native session alive when backgrounded.
 * Otherwise: pauses audio when the app goes to background.
 *
 * Wired in BackgroundAudioScreen and MainTabs so it always runs while the
 * main app is mounted.
 */
export function useAudioBackgroundController(): void {
  const tier = useHertzStore(s => s.tier);
  const backgroundAudio = useHertzStore(s => s.backgroundAudio);
  const unlocked = isPremiumUnlocked(tier);

  const unlockedRef = useRef(unlocked);
  const backgroundAudioRef = useRef(backgroundAudio);

  const backgroundPlaybackAllowed = unlocked && backgroundAudio;

  useEffect(() => {
    unlockedRef.current = unlocked;
  }, [unlocked]);

  useEffect(() => {
    backgroundAudioRef.current = backgroundAudio;
  }, [backgroundAudio]);

  useEffect(() => {
    syncNativeBackgroundPlayback(backgroundPlaybackAllowed);
  }, [backgroundPlaybackAllowed]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          if (unlockedRef.current && backgroundAudioRef.current) {
            syncNativeBackgroundPlayback(true);
          } else {
            syncNativeBackgroundPlayback(false);
            stopAudioEngine();
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);
}
