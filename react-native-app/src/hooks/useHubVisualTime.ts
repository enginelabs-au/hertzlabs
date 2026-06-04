import {useEffect, useRef, useState} from 'react';
import {useHertzStore} from '../state/store';

/** Idle preview rate when not playing (1 = wall clock; keeps slider + scroll in step). */
const IDLE_RATE = 1;

/**
 * Hub oscilloscope clock — locked to native `elapsedSec` while playing; smooth extrapolation between updates.
 */
export function useHubVisualTime(): number {
  const isPlaying = useHertzStore(s => s.isPlaying);
  const elapsedSec = useHertzStore(s => s.elapsedSec);
  const playAnchorRef = useRef({wallSec: 0, audioSec: 0});
  const idleAnchorRef = useRef({wallSec: Date.now() / 1000, audioSec: 0});
  const [, setFrame] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      playAnchorRef.current = {wallSec: Date.now() / 1000, audioSec: elapsedSec};
    } else {
      idleAnchorRef.current = {wallSec: Date.now() / 1000, audioSec: elapsedSec};
    }
  }, [isPlaying, elapsedSec]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setFrame(n => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const now = Date.now() / 1000;

  if (isPlaying) {
    const {wallSec, audioSec} = playAnchorRef.current;
    return audioSec + (now - wallSec);
  }

  const {wallSec, audioSec} = idleAnchorRef.current;
  return audioSec + (now - wallSec) * IDLE_RATE;
}
