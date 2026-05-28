import { useEffect, useState } from 'react';

import { ensureFirebaseSession } from '@/services/firebaseSession';
import { subscribeToReportEngagement } from '@/services/hazardReportService';
import type { ReportEngagement } from '@/types/hazard';

const emptyEngagement: ReportEngagement = {
  likeCount: 0,
  commentCount: 0,
  viewCount: 0,
  userReportCount: 0,
  likedByMe: false,
  reportedByMe: false,
  comments: [],
};

export function useReportEngagement(reportId?: string | null, userId?: string | null, idToken?: string | null) {
  const [engagement, setEngagement] = useState<ReportEngagement>(emptyEngagement);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    if (!reportId) {
      setEngagement(emptyEngagement);
      setError(null);
      return;
    }

    if (!idToken) {
      setEngagement(emptyEngagement);
      setError('Please sign in before viewing post engagement.');
      return;
    }

    setError(null);
    ensureFirebaseSession(idToken)
      .then((firebaseUid) => {
        if (!isMounted) return;

        unsubscribe = subscribeToReportEngagement(
          reportId,
          firebaseUid || userId || undefined,
          (nextEngagement) => {
            if (isMounted) setEngagement(nextEngagement);
          },
          (snapshotError) => {
            if (isMounted) setError(snapshotError.message);
          }
        );
      })
      .catch((sessionError) => {
        if (!isMounted) return;
        setError(sessionError instanceof Error ? sessionError.message : 'Unable to load post engagement.');
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [idToken, reportId, userId]);

  return { engagement, error };
}
