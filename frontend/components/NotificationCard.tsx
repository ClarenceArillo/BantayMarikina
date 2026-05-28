import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, useAppTheme } from '@/components/EmergencyUI';
import type { ReportNotification } from '@/types/hazard';
import { getSeverityStyle } from '@/utils/severity';

function formatTime(date: Date | null) {
  if (!date) return 'Syncing';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function NotificationCardComponent({
  expanded,
  notification,
  onToggle,
  onViewMap,
}: {
  expanded: boolean;
  notification: ReportNotification;
  onToggle: (notification: ReportNotification) => void;
  onViewMap: (notification: ReportNotification) => void;
}) {
  const theme = useAppTheme();
  const severity = notification.severity || notification.report?.severity || 'Moderate';
  const severityStyle = getSeverityStyle(theme, severity);
  const hazardType = notification.hazardType || notification.report?.hazardType || 'Hazard';
  const isOfficial = notification.type === 'official_alert' || notification.source === 'official' || notification.source === 'admin';
  const color = severityStyle.color;
  const background = severityStyle.backgroundColor;
  const imageUrl = notification.imageUrl || notification.report?.imageUrl;
  const capturedAtLabel = notification.capturedAtLabel || notification.report?.capturedAtLabel;
  const sourceLabel = notification.sourceLabel || (isOfficial ? 'OFFICIAL ALERT' : 'COMMUNITY');
  const metaLabel = useMemo(() => {
    const area = notification.affectedArea || notification.barangay || notification.report?.barangay || 'Marikina City';
    return `${hazardType} | ${area} | ${formatTime(notification.createdAt)}`;
  }, [hazardType, notification.affectedArea, notification.barangay, notification.createdAt, notification.report?.barangay]);

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: notification.read ? theme.borderSoft : color },
        isOfficial ? { borderColor: color, shadowColor: color, shadowOpacity: notification.read ? 0.1 : 0.22 } : null,
        !notification.read && !isOfficial ? { shadowColor: color, shadowOpacity: 0.16 } : null,
      ]}
      onPress={() => onToggle(notification)}>
      {isOfficial ? <View style={[styles.officialStrip, { backgroundColor: color }]} /> : null}
      <View style={styles.header}>
        <View style={[styles.unreadDot, { backgroundColor: notification.read ? theme.border : color }]} />
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            {isOfficial ? <Badge label={sourceLabel} tone="red" style={styles.sourceBadge} textStyle={styles.sourceBadgeText} /> : null}
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{notification.title}</Text>
          </View>
          <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>{metaLabel}</Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: background, borderColor: color }]}>
          <Text style={[styles.severityText, { color }]}>{severity}</Text>
        </View>
      </View>

      {expanded ? (
        <View style={styles.expanded}>
          {imageUrl ? (
            <View style={styles.imageFrame}>
              <Image source={{ uri: imageUrl }} style={styles.image} />
              {capturedAtLabel ? (
                <View style={styles.timestampBadge}>
                  <Text style={styles.timestampText}>{capturedAtLabel}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={[styles.body, { color: theme.text }]}>{notification.body || notification.report?.description || 'No details provided.'}</Text>
          {notification.safetyTip ? (
            <View style={[styles.safetyTip, { backgroundColor: background, borderColor: color }]}>
              <Text style={[styles.safetyTipLabel, { color }]}>Safety tip</Text>
              <Text style={[styles.safetyTipText, { color: theme.text }]}>{notification.safetyTip}</Text>
            </View>
          ) : null}
          <View style={styles.metaGrid}>
            <Text style={[styles.detail, { color: theme.muted }]}>
              Source: {isOfficial ? sourceLabel : notification.reporterName || notification.report?.reporterName || 'Resident'}
            </Text>
            {notification.latitude || notification.report?.latitude ? (
              <Text style={[styles.detail, { color: theme.muted }]}>
                Location: {notification.latitude?.toFixed?.(5) || notification.report?.latitude.toFixed(5)}, {notification.longitude?.toFixed?.(5) || notification.report?.longitude.toFixed(5)}
              </Text>
            ) : (
              <Text style={[styles.detail, { color: theme.muted }]}>Area: {notification.affectedArea || notification.barangay || 'Marikina City'}</Text>
            )}
          </View>
          {notification.reportId ? (
            <Pressable style={[styles.mapButton, { backgroundColor: theme.primary }]} onPress={() => onViewMap(notification)}>
              <Text style={styles.mapButtonText}>View on Map</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export const NotificationCard = memo(NotificationCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    overflow: 'hidden',
    padding: 14,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
  },
  officialStrip: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 5,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  unreadDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  titleBlock: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  sourceBadge: {
    minHeight: 20,
    paddingHorizontal: 7,
  },
  sourceBadgeText: {
    fontSize: 8,
  },
  meta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  severityBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '900',
  },
  expanded: {
    gap: 10,
    paddingTop: 12,
  },
  image: {
    borderRadius: 12,
    height: 150,
    width: '100%',
  },
  imageFrame: {
    position: 'relative',
  },
  timestampBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    bottom: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
  },
  timestampText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  safetyTip: {
    borderRadius: 13,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  safetyTipLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  safetyTipText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  metaGrid: {
    gap: 4,
  },
  detail: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});
