import { useEffect, useState } from 'react';

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

export function useReportEngagement(reportId?: string | null, userId?: string | null) {
  const [engagement, setEngagement] = useState<ReportEngagement>(emptyEngagement);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setEngagement(emptyEngagement);
      return;
    }

    setError(null);
    const unsubscribe = subscribeToReportEngagement(
      reportId,
      userId || undefined,
      setEngagement,
      (snapshotError) => setError(snapshotError.message)
    );

    return unsubscribe;
  }, [reportId, userId]);

  return { engagement, error };
}
