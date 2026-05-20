import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '@/components/BottomNav';
import { useAppTheme } from '@/components/EmergencyUI';
import { HazardDetailsSheet } from '@/components/HazardDetailsSheet';
import { HazardMapView } from '@/components/HazardMapView';
import { ReportFilterBar } from '@/components/ReportFilterBar';
import { useAuthSession } from '@/context/auth-context';
import { useHazardReports } from '@/hooks/useHazardReports';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import type { HazardReport, ReportFilters } from '@/types/hazard';

const iconSources = {
  pin: require('@/assets/Icons/Pin.png'),
};

function IconButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <Pressable style={[styles.iconButton, { backgroundColor: theme.surface, shadowColor: theme.black }]} onPress={onPress}>
      <Text style={[styles.iconButtonText, { color: theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const { session } = useAuthSession();
  const theme = useAppTheme();
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: 'month', hazardType: 'All', severity: 'All', status: 'All', source: 'All' });
  const { reports, isLoading, error } = useHazardReports(session?.idToken, 300, filters);
  const { location, isLocating, error: locationError, locateOnce } = useLiveLocation(true);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const userLocation = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      }
    : null;

  async function handleLocateMe() {
    await locateOnce().catch(() => undefined);
    setFocusSignal((value) => value + 1);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.mapShell}>
        <HazardMapView
          reports={reports}
          pinSource={iconSources.pin}
          userLocation={userLocation}
          isLoading={isLoading}
          error={error || locationError}
          height="100%"
          initialZoom={13}
          onMarkerPress={setSelectedReport}
          focusSignal={focusSignal}
        />

        <View style={[styles.headerBar, { backgroundColor: theme.surface, borderColor: theme.borderSoft, shadowColor: theme.black }]}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Live Hazard Map</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>{reports.length} active reports in Marikina</Text>
          </View>
        </View>

        <View style={[styles.filterPanel, { backgroundColor: theme.surface, borderColor: theme.borderSoft, shadowColor: theme.black }]}>
          <ReportFilterBar filters={filters} onChange={setFilters} compact />
        </View>

        <View style={styles.controls}>
          <IconButton label={isLocating ? 'Locating...' : 'Locate Me'} onPress={handleLocateMe} />
        </View>
      </View>

      <BottomNav activeTab="map" />
      <HazardDetailsSheet report={selectedReport} onClose={() => setSelectedReport(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mapShell: {
    flex: 1,
  },
  headerBar: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    elevation: 8,
    flexDirection: 'row',
    gap: 12,
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
    top: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  controls: {
    bottom: 98,
    flexDirection: 'row',
    gap: 10,
    left: 18,
    position: 'absolute',
    right: 18,
  },
  filterPanel: {
    borderRadius: 18,
    borderWidth: 1,
    elevation: 8,
    left: 16,
    padding: 10,
    position: 'absolute',
    right: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    top: 92,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 18,
    elevation: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  iconButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
});
