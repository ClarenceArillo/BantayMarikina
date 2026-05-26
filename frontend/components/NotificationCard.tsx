import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import type { ReportNotification } from '@/types/hazard';

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
  const hazardType = notification.hazardType || notification.report?.hazardType || 'Hazard';
  const isHigh = ['High', 'Critical'].includes(String(severity));
  const color = String(severity) === 'Moderate' ? theme.warning : isHigh ? theme.danger : theme.primary;
  const background = String(severity) === 'Moderate' ? theme.warningSoft : isHigh ? theme.dangerSoft : theme.primaryTint;
  const imageUrl = notification.imageUrl || notification.report?.imageUrl;
  const capturedAtLabel = notification.capturedAtLabel || notification.report?.capturedAtLabel;

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: notification.read ? theme.borderSoft : color },
        !notification.read ? { shadowColor: color, shadowOpacity: 0.16 } : null,
      ]}
      onPress={() => onToggle(notification)}>
      <View style={styles.header}>
        <View style={[styles.unreadDot, { backgroundColor: notification.read ? theme.border : color }]} />
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{notification.title}</Text>
          <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            {hazardType} • {notification.barangay || notification.report?.barangay || 'Marikina City'} • {formatTime(notification.createdAt)}
          </Text>
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
          <View style={styles.metaGrid}>
            <Text style={[styles.detail, { color: theme.muted }]}>Reporter: {notification.reporterName || notification.report?.reporterName || 'Resident'}</Text>
            <Text style={[styles.detail, { color: theme.muted }]}>
              Location: {notification.latitude?.toFixed?.(5) || notification.report?.latitude.toFixed(5)}, {notification.longitude?.toFixed?.(5) || notification.report?.longitude.toFixed(5)}
            </Text>
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
    padding: 14,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
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
  title: {
    fontSize: 14,
    fontWeight: '900',
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
