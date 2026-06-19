import {useEffect, useRef} from 'react';
import {useHertzStore} from '../state/store';
import {APP_VERSION} from '../constants/appInfo';
import {confirmThenRequestAppReview} from '../monetization/requestAppReview';
import {
  shouldOfferReviewPrompt,
  shouldShowPaywallNudge,
} from '../state/slices/growth';

const PLAYBACK_TICK_MS = 1000;

/**
 * Tracks launches + playback time, then triggers growth prompts:
 * - paywall nudge after demonstrated value (free tier, once)
 * - review prompt after 3+ min cumulative playback (once per version)
 */
export function useGrowthEngagement(enabled: boolean): void {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const tier = useHertzStore(s => s.tier);
  const activeModal = useHertzStore(s => s.activeModal);
  const appLaunchCount = useHertzStore(s => s.appLaunchCount);
  const cumulativePlaybackSec = useHertzStore(s => s.cumulativePlaybackSec);
  const reviewPromptedForVersion = useHertzStore(s => s.reviewPromptedForVersion);
  const paywallSoftPromptShown = useHertzStore(s => s.paywallSoftPromptShown);
  const recordAppLaunch = useHertzStore(s => s.recordAppLaunch);
  const addPlaybackSeconds = useHertzStore(s => s.addPlaybackSeconds);
  const markReviewPromptShown = useHertzStore(s => s.markReviewPromptShown);
  const markPaywallSoftPromptShown = useHertzStore(s => s.markPaywallSoftPromptShown);
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  const checkInStreak = useHertzStore(s => s.checkInStreak);
  const ensureFirstInstallDate = useHertzStore(s => s.ensureFirstInstallDate);

  const launchRecorded = useRef(false);
  const reviewScheduled = useRef(false);
  const paywallScheduled = useRef(false);

  useEffect(() => {
    if (!enabled || launchRecorded.current) {
      return;
    }
    launchRecorded.current = true;
    recordAppLaunch();
    checkInStreak();
    ensureFirstInstallDate();
  }, [enabled, recordAppLaunch, checkInStreak, ensureFirstInstallDate]);

  useEffect(() => {
    if (!enabled || !isPlaying) {
      return;
    }
    const id = setInterval(() => {
      addPlaybackSeconds(PLAYBACK_TICK_MS / 1000);
    }, PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [enabled, isPlaying, addPlaybackSeconds]);

  useEffect(() => {
    if (!enabled || activeModal != null) {
      return;
    }

    const state = useHertzStore.getState();

    if (
      !paywallScheduled.current &&
      shouldShowPaywallNudge({
        tier: state.tier,
        appLaunchCount: state.appLaunchCount,
        cumulativePlaybackSec: state.cumulativePlaybackSec,
        paywallSoftPromptShown: state.paywallSoftPromptShown,
      })
    ) {
      paywallScheduled.current = true;
      markPaywallSoftPromptShown();
      setActiveModal('paywall');
      return;
    }

    if (
      !reviewScheduled.current &&
      shouldOfferReviewPrompt({
        appLaunchCount: state.appLaunchCount,
        cumulativePlaybackSec: state.cumulativePlaybackSec,
        reviewPromptedForVersion: state.reviewPromptedForVersion,
        appVersion: APP_VERSION,
      })
    ) {
      reviewScheduled.current = true;
      markReviewPromptShown(APP_VERSION);
      confirmThenRequestAppReview();
    }
  }, [
    enabled,
    activeModal,
    tier,
    appLaunchCount,
    cumulativePlaybackSec,
    reviewPromptedForVersion,
    paywallSoftPromptShown,
    markPaywallSoftPromptShown,
    markReviewPromptShown,
    setActiveModal,
  ]);
}
