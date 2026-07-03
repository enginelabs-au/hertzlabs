import {useLayoutEffect} from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {useHertzStore} from '../state/store';
import {usePhoticPlaybackAnchorSync} from './usePhoticPlaybackAnchor';

/** UI-thread playback clock for photic stroke modulation (aligned to audio when playing). */
export function usePhoticStrobeClock() {
  const clockMs = useSharedValue(0);
  const isPlayingSV = useSharedValue(false);
  const elapsedSecSV = useSharedValue(0);
  const anchorFrameMs = useSharedValue(0);
  const anchorElapsedSec = useSharedValue(0);
  const reanchorFlag = useSharedValue(1);

  usePhoticPlaybackAnchorSync({
    isPlayingSV,
    elapsedSecSV,
    anchorFrameMs,
    anchorElapsedSec,
    reanchorFlag,
  });

  useFrameCallback(frame => {
    'worklet';
    if (reanchorFlag.value) {
      anchorFrameMs.value = frame.timestamp;
      anchorElapsedSec.value = elapsedSecSV.value;
      reanchorFlag.value = 0;
    }
    clockMs.value = frame.timestamp;
  }, true);

  return {clockMs, isPlayingSV, anchorFrameMs, anchorElapsedSec};
}

/** Store-backed photic toggle mirrored to the UI thread for Skia worklets. */
export function usePhoticStrobeEnabledSV(): SharedValue<boolean> {
  const enabledSV = useSharedValue(useHertzStore.getState().photicStrobeEnabled);

  useLayoutEffect(() => {
    return useHertzStore.subscribe(
      s => s.photicStrobeEnabled,
      enabled => {
        enabledSV.value = enabled;
      },
      {fireImmediately: true},
    );
  }, [enabledSV]);

  return enabledSV;
}
