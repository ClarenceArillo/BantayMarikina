import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureFirebaseSession } from '@/services/firebaseSession';
import { subscribeToHazardReports } from '@/services/hazardReportService';
import type { HazardReport, ReportFilters } from '@/types/hazard';

export function useHazardReports(idToken?: string | null, maxReports = 300, filters?: ReportFilters) {
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isMounted = true;
    let shouldSubscribe = false;
    let appStateSubscription: { remove: () => void } | undefined;

    const stop = () => {
      shouldSubscribe = false;
      unsubscribe?.();
      unsubscribe = undefined;
    };

    const start = () => {
      stop();
      shouldSubscribe = true;
      setIsLoading(true);
      setError(null);

      ensureFirebaseSession(idToken)
        .then(() => {
          if (!isMounted || !shouldSubscribe) return;

          try {
            unsubscribe = subscribeToHazardReports(
              (nextReports) => {
                if (!isMounted) return;
                setReports(nextReports);
                setIsLoading(false);
              },
              (snapshotError) => {
                if (!isMounted) return;
                setError(snapshotError.message);
                setIsLoading(false);
              },
              maxReports,
              filters
            );
          } catch (subscriptionError) {
            if (!isMounted) return;
            setError(subscriptionError instanceof Error ? subscriptionError.message : 'Unable to start live map.');
            setIsLoading(false);
          }
        })
        .catch((sessionError) => {
          if (!isMounted || !shouldSubscribe) return;
          setError(sessionError instanceof Error ? sessionError.message : 'Unable to start live map.');
          setIsLoading(false);
        });
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        start();
      } else {
        stop();
      }
    };

    if (AppState.currentState === 'active') {
      start();
    } else {
      setIsLoading(false);
    }
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      appStateSubscription?.remove();
      stop();
    };
  }, [filters, idToken, maxReports]);

  return { reports, isLoading, error };
}
