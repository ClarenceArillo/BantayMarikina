import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
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
  const displayTime = report ? formatDate(report) : null;

  return (
    <Modal visible={Boolean(report)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {report ? (
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.type}>{report.hazardType}</Text>
              <Text style={styles.location}>{report.barangay || 'Marikina City'}</Text>
            </View>
            <View style={styles.severityBadge}>
              <Text style={styles.severityText}>{report.severity || 'Unverified'}</Text>
            </View>
          </View>

          {report.imageUrl ? <Image source={{ uri: report.imageUrl }} style={styles.photo} /> : null}

          <Text style={styles.description}>{report.description || 'No description provided.'}</Text>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{displayTime?.date}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Time</Text>
              <Text style={styles.metaValue}>{displayTime?.time || '--'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Reporter</Text>
              <Text style={styles.metaValue}>{report.reporterName || 'Resident'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Coordinates</Text>
              <Text style={styles.metaValue}>
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    flex: 1,
  },
  sheet: {
    backgroundColor: '#fff',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#d6dde5',
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
    color: Colors.light.text,
    fontSize: 22,
    fontWeight: '900',
  },
  location: {
    color: Colors.light.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  severityBadge: {
    backgroundColor: '#fff2d9',
    borderColor: '#f2b447',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  severityText: {
    color: '#8a5d12',
    fontSize: 11,
    fontWeight: '900',
  },
  photo: {
    borderRadius: 12,
    height: 156,
    width: '100%',
  },
  description: {
    color: '#26343d',
    fontSize: 14,
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    backgroundColor: '#f4f7fa',
    borderRadius: 12,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  metaLabel: {
    color: Colors.light.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: Colors.light.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
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
