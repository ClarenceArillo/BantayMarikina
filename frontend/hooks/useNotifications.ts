import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureFirebaseSession } from '@/services/firebaseSession';
import { subscribeToNotifications } from '@/services/hazardReportService';
import type { ReportFilters, ReportNotification } from '@/types/hazard';

export function useNotifications(userId?: string | null, idToken?: string | null, filters?: ReportFilters) {
  const [notifications, setNotifications] = useState<ReportNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isMounted = true;
    let shouldSubscribe = false;
    let appStateSubscription: { remove: () => void } | undefined;

    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

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

          unsubscribe = subscribeToNotifications(
            userId,
            (nextNotifications) => {
              if (!isMounted) return;
              setNotifications(nextNotifications);
              setIsLoading(false);
            },
            (snapshotError) => {
              if (!isMounted) return;
              setError(snapshotError.message);
              setIsLoading(false);
            },
            120,
            filters
          );
        })
        .catch((sessionError) => {
          if (!isMounted || !shouldSubscribe) return;
          setError(sessionError instanceof Error ? sessionError.message : 'Unable to load notifications.');
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
  }, [filters, idToken, userId]);

  return { notifications, isLoading, error };
}
