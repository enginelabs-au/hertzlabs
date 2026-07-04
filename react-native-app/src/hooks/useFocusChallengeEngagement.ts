import {useEffect, useRef} from 'react';
import {fetchFocusChallengeStatus} from '../promos/focusChallengeSync';
import {useHertzStore} from '../state/store';

const PLAYBACK_TICK_MS = 1000;

/**
 * Tracks focus-challenge session playback and opens reflection when threshold met.
 */
export function useFocusChallengeEngagement(hydrated: boolean, promptsEnabled: boolean): void {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const focusChallengeSessionActive = useHertzStore(s => s.focusChallengeSessionActive);
  const focusChallengeReflectionPending = useHertzStore(s => s.focusChallengeReflectionPending);
  const focusChallengeStatus = useHertzStore(s => s.focusChallengeStatus);
  const activeModal = useHertzStore(s => s.activeModal);

  const addFocusChallengePlaybackSec = useHertzStore(s => s.addFocusChallengePlaybackSec);
  const syncFocusChallengeMissedDay = useHertzStore(s => s.syncFocusChallengeMissedDay);
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  const focusChallengeAttemptId = useHertzStore(s => s.focusChallengeAttemptId);
  const applyFocusChallengeServerPatch = useHertzStore(s => s.applyFocusChallengeServerPatch);

  const missedSynced = useRef(false);
  const serverSynced = useRef(false);

  useEffect(() => {
    if (!hydrated || !promptsEnabled || serverSynced.current) {
      return;
    }
    serverSynced.current = true;
    void fetchFocusChallengeStatus(focusChallengeAttemptId).then(status => {
      if (status == null || status.status === 'idle') {
        return;
      }
      applyFocusChallengeServerPatch({
        status: status.status,
        attemptId: status.attemptId,
        currentDay: status.currentDay,
        lastCompletedDate: status.lastCompletedDate,
        rewardClaimed: status.rewardClaimed,
      });
    });
  }, [
    hydrated,
    promptsEnabled,
    focusChallengeAttemptId,
    applyFocusChallengeServerPatch,
  ]);

  useEffect(() => {
    if (!hydrated || !promptsEnabled || missedSynced.current) {
      return;
    }
    if (focusChallengeStatus === 'active') {
      missedSynced.current = true;
      syncFocusChallengeMissedDay();
    }
  }, [hydrated, promptsEnabled, focusChallengeStatus, syncFocusChallengeMissedDay]);

  useEffect(() => {
    if (!promptsEnabled || !isPlaying || !focusChallengeSessionActive) {
      return;
    }
    const id = setInterval(() => {
      addFocusChallengePlaybackSec(PLAYBACK_TICK_MS / 1000);
    }, PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [promptsEnabled, isPlaying, focusChallengeSessionActive, addFocusChallengePlaybackSec]);

  useEffect(() => {
    if (!hydrated || !promptsEnabled || !focusChallengeReflectionPending) {
      return;
    }
    if (activeModal == null) {
      setActiveModal('focusChallengeReflection');
    }
  }, [
    hydrated,
    promptsEnabled,
    focusChallengeReflectionPending,
    activeModal,
    setActiveModal,
  ]);
}
