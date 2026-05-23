import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import type { HazardReport } from '@/types/hazard';

const defaultProfile = require('@/assets/Icons/Default Profile.png');
const likeIcon = require('@/assets/Icons/Like.png');
const commentIcon = require('@/assets/Icons/Comment.png');
const reportIcon = require('@/assets/Icons/Report.png');
const pinIcon = require('@/assets/Icons/Pin.png');

function formatTime(date: Date | null) {
  if (!date) return 'Syncing';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function severityTone(severity?: string) {
  const value = severity?.toLowerCase();
  if (value === 'critical') return 'critical';
  if (value === 'high') return 'high';
  if (value === 'moderate') return 'moderate';
  return 'low';
}

function hazardGlyph(hazardType?: string) {
  if (hazardType === 'Flood') return '~';
  if (hazardType === 'Fire') return '!';
  if (hazardType === 'Power Outage') return 'Z';
  return '*';
}

function ReportCardComponent({ report, onPress }: { report: HazardReport; onPress: (report: HazardReport) => void }) {
  const theme = useAppTheme();
  const tone = severityTone(report.severity);
  const toneColor = tone === 'critical' || tone === 'high' ? theme.danger : tone === 'moderate' ? theme.warning : theme.primary;
  const toneBg = tone === 'critical' || tone === 'high' ? theme.dangerSoft : tone === 'moderate' ? theme.warningSoft : theme.primaryTint;

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]} onPress={() => onPress(report)}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Image source={report.reporterPhotoUrl ? { uri: report.reporterPhotoUrl } : defaultProfile} style={[styles.avatar, { backgroundColor: theme.surfaceMuted }]} />
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{report.reporterName || 'Resident'}</Text>
            <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
              {formatTime(report.timestamp)} - {report.source === 'official' ? 'Verified source' : 'Community post'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: toneBg, borderColor: toneColor }]}>
            <Text style={[styles.badgeText, { color: toneColor }]}>{report.severity || 'Live'}</Text>
          </View>
        </View>
        <View style={styles.hazardRow}>
          <Text style={[styles.hazardIcon, { color: toneColor }]}>{hazardGlyph(report.hazardType)}</Text>
          <Text style={[styles.hazardText, { color: theme.text }]} numberOfLines={1}>{report.title || report.hazardType}</Text>
        </View>
        <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>{report.description}</Text>
      </View>
      {report.imageUrl ? <Image source={{ uri: report.imageUrl }} style={[styles.image, { backgroundColor: theme.surfaceMuted }]} fadeDuration={220} /> : null}
      <View style={styles.footer}>
        <View style={styles.locationRow}>
          <Image source={pinIcon} style={[styles.tinyIcon, { tintColor: theme.primary }]} resizeMode="contain" />
          <Text style={[styles.locationText, { color: theme.muted }]} numberOfLines={1}>{report.barangay || 'Marikina City'}</Text>
        </View>
        <View style={[styles.metrics, { borderTopColor: theme.borderSoft }]}>
          <View style={styles.metricItem}>
            <Image source={likeIcon} style={[styles.metricIcon, { tintColor: theme.muted }]} resizeMode="contain" />
            <Text style={[styles.metric, { color: theme.muted }]}>{report.likeCount || 0}</Text>
          </View>
          <View style={styles.metricItem}>
            <Image source={commentIcon} style={[styles.metricIcon, { tintColor: theme.muted }]} resizeMode="contain" />
            <Text style={[styles.metric, { color: theme.muted }]}>{report.commentCount || 0}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.eyeText, { color: theme.muted }]}>Views</Text>
            <Text style={[styles.metric, { color: theme.muted }]}>{report.viewCount || 0}</Text>
          </View>
          <View style={styles.metricItem}>
            <Image source={reportIcon} style={[styles.metricIcon, { tintColor: theme.muted }]} resizeMode="contain" />
            <Text style={[styles.metric, { color: theme.muted }]}>{report.userReportCount || 0}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const ReportCard = memo(ReportCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    height: 156,
    width: '100%',
  },
  body: {
    gap: 10,
    padding: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  meta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  badge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  hazardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  hazardIcon: {
    fontSize: 17,
    fontWeight: '900',
  },
  hazardText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tinyIcon: {
    height: 13,
    width: 13,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  metrics: {
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 9,
  },
  metricItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  metricIcon: {
    height: 15,
    width: 15,
  },
  metric: {
    fontSize: 11,
    fontWeight: '800',
  },
  eyeText: {
    fontSize: 10,
    fontWeight: '900',
  },
});
