import {useEffect, useState} from 'react';

/** Throttled clock — avoids 60 React re-renders/s (major source of Math mode jank). */
export function useMathVisualClock(fps = 22): number {
  const [timeSec, setTimeSec] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const ms = Math.max(16, Math.round(1000 / fps));
    const id = setInterval(() => {
      setTimeSec((Date.now() - t0) / 1000);
    }, ms);
    return () => clearInterval(id);
  }, [fps]);

  return timeSec;
}
