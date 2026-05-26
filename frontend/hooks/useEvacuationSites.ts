import { useEffect, useState } from 'react';

import { subscribeToEvacuationSites } from '@/services/evacuationSiteService';
import type { EvacuationSite } from '@/types/evacuation';

export function useEvacuationSites(enabled = true) {
  const [sites, setSites] = useState<EvacuationSite[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSites([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToEvacuationSites(
      (nextSites) => {
        setSites(nextSites);
        setIsLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [enabled]);

  return { sites, isLoading, error };
}
