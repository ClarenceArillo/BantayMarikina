export function formatReportDateTime(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return { date: 'Syncing', time: 'Syncing', compact: 'Syncing' };

  return {
    date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    compact: date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}
