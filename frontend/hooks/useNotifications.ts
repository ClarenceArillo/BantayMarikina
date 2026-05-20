import { useEffect, useState } from 'react';

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

    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    ensureFirebaseSession(idToken)
      .then(() => {
        if (!isMounted) return;

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
        if (!isMounted) return;
        setError(sessionError instanceof Error ? sessionError.message : 'Unable to load notifications.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [filters, idToken, userId]);

  return { notifications, isLoading, error };
}
