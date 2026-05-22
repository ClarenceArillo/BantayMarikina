import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '@/components/BottomNav';
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
  const { notifications, isLoading, error } = useNotifications(session?.uid, session?.idToken, filters);
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  function toggleNotification(notification: ReportNotification) {
    setExpandedId((current) => (current === notification.id ? null : notification.id));
    if (session?.uid && !notification.read) {
      markNotificationRead(session.uid, notification.id).catch(() => undefined);
    }
  }

  function viewOnMap(notification: ReportNotification) {
    if (session?.uid && !notification.read) {
      markNotificationRead(session.uid, notification.id).catch(() => undefined);
    }
    router.replace('/map' as never);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.muted }]}>{group.title}</Text>
            {group.items.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                expanded={expandedId === notification.id}
                onToggle={toggleNotification}
                onViewMap={viewOnMap}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <BottomNav activeTab="notification" />
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
  group: {
    gap: 10,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
