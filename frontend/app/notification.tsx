import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import { NotificationCard } from '@/components/NotificationCard';
import { ReportFilterBar } from '@/components/ReportFilterBar';
import { useAuthSession } from '@/context/auth-context';
import { useNotifications } from '@/hooks/useNotifications';
import { markNotificationRead } from '@/services/hazardReportService';
import type { ReportFilters, ReportNotification } from '@/types/hazard';

function dateBucket(date: Date | null) {
  if (!date) return 'Today';
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - ((startToday.getDay() || 7) - 1));
  const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);

  if (date >= startToday) return 'Today';
  if (date >= startYesterday) return 'Yesterday';
  if (date >= startWeek) return 'Earlier This Week';
  if (date >= startMonth) return 'Earlier This Month';
  return 'Older';
}

function groupNotifications(notifications: ReportNotification[]) {
  return notifications.reduce<{ title: string; items: ReportNotification[] }[]>((groups, notification) => {
    const title = dateBucket(notification.createdAt);
    const group = groups.find((item) => item.title === title);

    if (group) {
      group.items.push(notification);
    } else {
      groups.push({ title, items: [notification] });
    }

    return groups;
  }, []);
}

export default function NotificationScreen() {
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: 'month', hazardType: 'All', severity: 'All', status: 'All', source: 'All' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pendingReadIdsRef = useRef(new Set<string>());
  const { notifications, isLoading, error } = useNotifications(session?.uid, session?.idToken, filters);
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const listItems = useMemo(() => groups.flatMap((group) => [
    { id: `header-${group.title}`, title: group.title, type: 'header' as const },
    ...group.items.map((notification) => ({ id: notification.id, notification, type: 'notification' as const })),
  ]), [groups]);

  const markReadOnce = useCallback((notification: ReportNotification) => {
    if (!session?.uid || notification.read || pendingReadIdsRef.current.has(notification.id)) return;

    pendingReadIdsRef.current.add(notification.id);
    markNotificationRead(session.uid, notification.id).finally(() => {
      pendingReadIdsRef.current.delete(notification.id);
    });
  }, [session?.uid]);

  const toggleNotification = useCallback((notification: ReportNotification) => {
    setExpandedId((current) => (current === notification.id ? null : notification.id));
    markReadOnce(notification);
  }, [markReadOnce]);

  const viewOnMap = useCallback((notification: ReportNotification) => {
    markReadOnce(notification);
    router.replace('/map' as never);
  }, [markReadOnce]);

  const renderItem = useCallback(({ item }: { item: (typeof listItems)[number] }) => {
    if (item.type === 'header') {
      return <Text style={[styles.groupTitle, { color: theme.muted }]}>{item.title}</Text>;
    }

    return (
      <NotificationCard
        notification={item.notification}
        expanded={expandedId === item.notification.id}
        onToggle={toggleNotification}
        onViewMap={viewOnMap}
      />
    );
  }, [expandedId, theme.muted, toggleNotification, viewOnMap]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={listItems}
        initialNumToRender={8}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>{unreadCount} unread community alerts</Text>
            </View>
            <ReportFilterBar filters={filters} onChange={setFilters} />
            {isLoading ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}
            {error ? <Text style={[styles.error, { color: theme.danger, backgroundColor: theme.dangerSoft }]}>{error}</Text> : null}
            {!isLoading && groups.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No alerts yet</Text>
                <Text style={[styles.emptyBody, { color: theme.muted }]}>New community hazard reports will appear here in real time.</Text>
              </View>
            ) : null}
          </View>
        )}
        maxToRenderPerBatch={8}
        removeClippedSubviews
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={60}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 118,
  },
  header: {
    gap: 3,
  },
  listHeader: {
    gap: 16,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  loader: {
    marginTop: 16,
  },
  error: {
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '800',
    padding: 12,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
