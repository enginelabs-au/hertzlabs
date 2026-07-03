import {useEffect} from 'react';
import type {SharedValue} from 'react-native-reanimated';
import {useHertzStore} from '../state/store';

export type PhoticAnchorSVs = {
  isPlayingSV: SharedValue<boolean>;
  elapsedSecSV: SharedValue<number>;
  anchorFrameMs: SharedValue<number>;
  anchorElapsedSec: SharedValue<number>;
  reanchorFlag: SharedValue<number>;
};

/** Syncs native playback clock into UI-thread anchor shared values. */
export function usePhoticPlaybackAnchorSync(anchor: PhoticAnchorSVs) {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const elapsedSec = useHertzStore(s => s.elapsedSec);
  const elapsedClockEpoch = useHertzStore(s => s.elapsedClockEpoch);

  useEffect(() => {
    anchor.isPlayingSV.value = isPlaying;
    anchor.elapsedSecSV.value = elapsedSec;
    anchor.reanchorFlag.value = 1;
  }, [
    isPlaying,
    elapsedSec,
    elapsedClockEpoch,
    anchor.isPlayingSV,
    anchor.elapsedSecSV,
    anchor.reanchorFlag,
  ]);
}
