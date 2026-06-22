import {useEffect} from 'react';
import {fetchPromoRewardStatus} from '../../promos/checkPromoRewards';
import {useHertzStore} from '../../state/store';

/** After RC is configured, sync admin-approved outreach reward status (display only). */
export function usePromoRewardBoot(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await new Promise(r => setTimeout(r, 1500));
      if (cancelled) {
        return;
      }
      const statuses = await fetchPromoRewardStatus();
      if (cancelled || statuses == null) {
        return;
      }
      useHertzStore.getState().syncPromoRewardStatuses(statuses);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
