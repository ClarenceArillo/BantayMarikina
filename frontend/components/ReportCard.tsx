import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import type { HazardReport } from '@/types/hazard';

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

export function ReportCard({ report, onPress }: { report: HazardReport; onPress: (report: HazardReport) => void }) {
  const theme = useAppTheme();
  const tone = severityTone(report.severity);
  const toneColor = tone === 'critical' || tone === 'high' ? theme.danger : tone === 'moderate' ? theme.warning : theme.primary;
  const toneBg = tone === 'critical' || tone === 'high' ? theme.dangerSoft : tone === 'moderate' ? theme.warningSoft : theme.primaryTint;

  return (
    <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]} onPress={() => onPress(report)}>
      {report.imageUrl ? <Image source={{ uri: report.imageUrl }} style={styles.image} /> : null}
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{report.title || report.hazardType}</Text>
            <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
              {report.barangay || 'Marikina City'} • {formatTime(report.timestamp)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: toneBg, borderColor: toneColor }]}>
            <Text style={[styles.badgeText, { color: toneColor }]}>{report.severity || 'Live'}</Text>
          </View>
        </View>
        <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>{report.description}</Text>
        <View style={styles.metrics}>
          <Text style={[styles.metric, { color: theme.muted }]}>{report.likeCount || 0} likes</Text>
          <Text style={[styles.metric, { color: theme.muted }]}>{report.commentCount || 0} comments</Text>
          <Text style={[styles.metric, { color: theme.muted }]}>{report.viewCount || 0} views</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    height: 132,
    width: '100%',
  },
  body: {
    gap: 10,
    padding: 14,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
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
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    fontSize: 11,
    fontWeight: '800',
  },
});
