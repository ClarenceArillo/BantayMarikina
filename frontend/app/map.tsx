import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { BottomNav } from '@/components/BottomNav';
import { HazardDetailsSheet } from '@/components/HazardDetailsSheet';
import { HazardMapView } from '@/components/HazardMapView';
import { Colors } from '@/constants/theme';
import { useAuthSession } from '@/context/auth-context';
import { useHazardReports } from '@/hooks/useHazardReports';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import type { HazardReport } from '@/types/hazard';

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
  return (
    <Pressable style={styles.iconButton} onPress={onPress}>
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const { session } = useAuthSession();
  const { reports, isLoading, error } = useHazardReports(session?.idToken);
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
    <SafeAreaView style={styles.safeArea}>
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

        <View style={styles.headerBar}>
          <View>
            <Text style={styles.title}>Live Hazard Map</Text>
            <Text style={styles.subtitle}>{reports.length} active reports in Marikina</Text>
          </View>
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
    backgroundColor: '#fff',
    flex: 1,
  },
  mapShell: {
    flex: 1,
  },
  headerBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    elevation: 8,
    flexDirection: 'row',
    gap: 12,
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
    top: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  title: {
    color: Colors.light.text,
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.light.muted,
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
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    elevation: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  iconButtonText: {
    color: Colors.light.primary,
    fontSize: 13,
    fontWeight: '900',
  },
});
