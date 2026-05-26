import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import { HazardDetailsSheet } from '@/components/HazardDetailsSheet';
import { HazardMapView } from '@/components/HazardMapView';
import { ReportFilterBar } from '@/components/ReportFilterBar';
import { useAuthSession } from '@/context/auth-context';
import { useEvacuationSites } from '@/hooks/useEvacuationSites';
import { useHazardReports } from '@/hooks/useHazardReports';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import type { HazardReport, ReportFilters } from '@/types/hazard';

const iconSources = {
  evacuation: require('@/assets/Icons/Evacuation.png'),
  filter: require('@/assets/Icons/FilterIcon.png'),
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

function MapCapsule({
  active,
  icon,
  label,
  tone,
  onPress,
}: {
  active: boolean;
  icon: number;
  label: string;
  tone: 'primary' | 'danger';
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const activeColor = tone === 'danger' ? theme.danger : theme.primary;
  const activeBg = tone === 'danger' ? theme.dangerSoft : theme.primaryTint;

  return (
    <Pressable
      style={[
        styles.mapCapsule,
        { backgroundColor: theme.surface, borderColor: theme.borderSoft, shadowColor: theme.black },
        active ? { backgroundColor: activeBg, borderColor: activeColor } : null,
      ]}
      onPress={onPress}>
      <Image source={icon} style={[styles.capsuleIcon, { tintColor: active ? activeColor : theme.primary }]} resizeMode="contain" />
      <Text style={[styles.capsuleText, { color: active ? activeColor : theme.primary }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const params = useLocalSearchParams<{ evacuation?: string }>();
  const { session } = useAuthSession();
  const theme = useAppTheme();
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: 'month', hazardType: 'All', severity: 'All', status: 'All', source: 'All' });
  const { reports, isLoading, error } = useHazardReports(session?.idToken, 300, filters);
  const { location, isLocating, error: locationError, locateOnce } = useLiveLocation(true);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isEvacuationVisible, setIsEvacuationVisible] = useState(() => params.evacuation === '1');
  const {
    sites: evacuationSites,
    isLoading: isLoadingEvacuationSites,
    error: evacuationSitesError,
  } = useEvacuationSites(isEvacuationVisible);

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

  useEffect(() => {
    if (params.evacuation === '1') {
      setIsEvacuationVisible(true);
    }
  }, [params.evacuation]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.mapShell}>
        <HazardMapView
          reports={reports}
          evacuationSites={evacuationSites}
          pinSource={iconSources.pin}
          userLocation={userLocation}
          isLoading={isLoading}
          error={error || locationError || (isEvacuationVisible ? evacuationSitesError : null)}
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

        <View style={styles.mapModeRow}>
          <MapCapsule
            active={isFilterVisible}
            icon={iconSources.filter}
            label="Filter"
            tone="primary"
            onPress={() => setIsFilterVisible((value) => !value)}
          />
          <MapCapsule
            active={isEvacuationVisible}
            icon={iconSources.evacuation}
            label="Evacuation"
            tone="danger"
            onPress={() => setIsEvacuationVisible((value) => !value)}
          />
        </View>

        {isFilterVisible ? (
          <View style={[styles.filterPanel, { backgroundColor: theme.surface, borderColor: theme.borderSoft, shadowColor: theme.black }]}>
            <ReportFilterBar filters={filters} onChange={setFilters} compact />
          </View>
        ) : null}

        {isEvacuationVisible ? (
          <View style={[styles.evacuationBadge, { backgroundColor: theme.dangerSoft, borderColor: theme.danger, shadowColor: theme.black }]}>
            <Image source={iconSources.evacuation} style={[styles.evacuationBadgeIcon, { tintColor: theme.danger }]} resizeMode="contain" />
            <Text style={[styles.evacuationBadgeText, { color: theme.danger }]}>
              {isLoadingEvacuationSites ? 'Loading evacuation sites' : `${evacuationSites.length} evacuation sites visible`}
            </Text>
          </View>
        ) : null}

        <View style={styles.controls}>
          <IconButton label={isLocating ? 'Locating...' : 'Locate Me'} onPress={handleLocateMe} />
        </View>
      </View>

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
  mapModeRow: {
    flexDirection: 'row',
    gap: 12,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 92,
  },
  mapCapsule: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  capsuleIcon: {
    height: 24,
    width: 24,
  },
  capsuleText: {
    fontSize: 16,
    fontWeight: '900',
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
    top: 160,
  },
  evacuationBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 160,
    elevation: 9,
    flexDirection: 'row',
    gap: 8,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  evacuationBadgeIcon: {
    height: 18,
    width: 18,
  },
  evacuationBadgeText: {
    fontSize: 12,
    fontWeight: '900',
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
