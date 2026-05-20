import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import type { HazardReport } from '@/types/hazard';

function formatDate(report: HazardReport) {
  if (!report.timestamp) return { date: 'Pending sync', time: '' };

  return {
    date: report.timestamp.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: report.timestamp.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

export function HazardDetailsSheet({
  report,
  onClose,
}: {
  report: HazardReport | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const displayTime = report ? formatDate(report) : null;

  return (
    <Modal visible={Boolean(report)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      {report ? (
        <View style={[styles.sheet, { backgroundColor: theme.surface, shadowColor: theme.black }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <View>
              <Text style={[styles.type, { color: theme.text }]}>{report.hazardType}</Text>
              <Text style={[styles.location, { color: theme.muted }]}>{report.barangay || 'Marikina City'}</Text>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
              <Text style={[styles.severityText, { color: theme.warning }]}>{report.severity || 'Unverified'}</Text>
            </View>
          </View>

          {report.imageUrl ? <Image source={{ uri: report.imageUrl }} style={styles.photo} /> : null}

          <Text style={[styles.description, { color: theme.text }]}>{report.description || 'No description provided.'}</Text>

          <View style={styles.metaGrid}>
            <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.metaLabel, { color: theme.muted }]}>Date</Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>{displayTime?.date}</Text>
            </View>
            <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.metaLabel, { color: theme.muted }]}>Time</Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>{displayTime?.time || '--'}</Text>
            </View>
            <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.metaLabel, { color: theme.muted }]}>Reporter</Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>{report.reporterName || 'Resident'}</Text>
            </View>
            <View style={[styles.metaItem, { backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.metaLabel, { color: theme.muted }]}>Coordinates</Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          <Pressable style={[styles.closeButton, { backgroundColor: theme.primary }]} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    bottom: 0,
    elevation: 18,
    gap: 14,
    left: 0,
    padding: 20,
    paddingBottom: 28,
    position: 'absolute',
    right: 0,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    width: 46,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  type: {
    fontSize: 22,
    fontWeight: '900',
  },
  location: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  severityBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '900',
  },
  photo: {
    borderRadius: 12,
    height: 156,
    width: '100%',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    borderRadius: 12,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
