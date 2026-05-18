import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuthSession } from '@/context/auth-context';
import {
  getDashboardSnapshot,
  refreshDashboardData,
  RiverStation,
  subscribeDashboardData,
  WaterLevelData,
  WeatherData,
  WeatherForecast,
} from '@/services/dashboardService';

const mapStatic = require('@/assets/statics/map-static.png');
const profileStatic = require('@/assets/statics/pfp.png');
const iconSources = {
  alert: require('@/assets/Icons/Alert.png'),
  bantayLogo: require('@/assets/Icons/BantayLogo.png'),
  cloudyDay: require('@/assets/Icons/CloudyDay.png'),
  evacuation: require('@/assets/Icons/Evacuation.png'),
  home: require('@/assets/Icons/Home.png'),
  homeActive: require('@/assets/Icons/Home (2).png'),
  hotline: require('@/assets/Icons/Hotline.png'),
  map: require('@/assets/Icons/Map.png'),
  mapActive: require('@/assets/Icons/Map (2).png'),
  notification: require('@/assets/Icons/Notification.png'),
  notificationActive: require('@/assets/Icons/Notification (2).png'),
  pin: require('@/assets/Icons/Pin.png'),
  profile: require('@/assets/Icons/Profile.png'),
  profileActive: require('@/assets/Icons/Profile (2).png'),
  rainyDay: require('@/assets/Icons/RainyDay.png'),
  safetyTips: require('@/assets/Icons/SafetyTips.png'),
  sunnyDay: require('@/assets/Icons/SunnyDay.png'),
  water: require('@/assets/Icons/Water.png'),
};

const statusPalette = {
  Normal: { background: '#e4f8d9', foreground: '#538b3b', dot: '#589f39' },
  Warning: { background: '#f8eab4', foreground: '#a79531', dot: '#a7942c' },
  Critical: { background: '#f2c7c7', foreground: '#b13535', dot: '#b03535' },
  Unavailable: { background: '#e7eaee', foreground: '#6a737d', dot: '#88929d' },
};

function getFirstName(fullName: string) {
  const cleanName = fullName.trim();
  return cleanName ? cleanName.split(/\s+/)[0] : 'Juan';
}

function formatLevel(level: number | null) {
  if (level === null || level === undefined) return '--';
  return level.toFixed(2);
}

function getSourceLabel(sourceStatus?: string) {
  if (!sourceStatus) return 'Cached';
  if (sourceStatus === 'no_readings') return 'No Reading';
  return sourceStatus === 'ok' ? 'Live' : 'Source Offline';
}

function AssetIcon({
  source,
  style,
  tintColor,
}: {
  source: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  tintColor?: string;
}) {
  return <Image source={source} style={[style, tintColor ? { tintColor } : null]} resizeMode="contain" />;
}

function getWeatherIcon(condition?: string) {
  const lower = condition?.toLowerCase() ?? '';
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('thunder')) {
    return iconSources.rainyDay;
  }
  if (lower.includes('cloud') || lower.includes('overcast') || lower.includes('fog')) {
    return iconSources.cloudyDay;
  }
  return iconSources.sunnyDay;
}

function WeatherGlyph({ condition, small = false }: { condition?: string; small?: boolean }) {
  return (
    <AssetIcon
      source={getWeatherIcon(condition)}
      style={small ? styles.weatherIconSmall : styles.weatherIconLarge}
    />
  );
}

function PinIcon({ color = '#d93a3a' }: { color?: string }) {
  return (
    <AssetIcon source={iconSources.pin} style={styles.pinIcon} tintColor={color} />
  );
}

function SectionIcon({ type }: { type: 'water' | 'map' }) {
  return <AssetIcon source={type === 'water' ? iconSources.water : iconSources.mapActive} style={styles.sectionIcon} />;
}

function NavIcon({ name, active = false }: { name: 'home' | 'map' | 'report' | 'bell' | 'user'; active?: boolean }) {
  const sourceByName = {
    home: active ? iconSources.homeActive : iconSources.home,
    map: active ? iconSources.mapActive : iconSources.map,
    report: iconSources.alert,
    bell: active ? iconSources.notificationActive : iconSources.notification,
    user: active ? iconSources.profileActive : iconSources.profileActive,
  };

  return <AssetIcon source={sourceByName[name]} style={styles.navIcon} />;
}

function ActionIcon({ type }: { type: 'evacuation' | 'hotlines' | 'tips' }) {
  const sourceByType = {
    evacuation: iconSources.evacuation,
    hotlines: iconSources.hotline,
    tips: iconSources.safetyTips,
  };

  return <AssetIcon source={sourceByType[type]} style={styles.actionIcon} />;
}

function StatusBadge({ status }: { status: RiverStation['status'] }) {
  const palette = statusPalette[status as keyof typeof statusPalette] ?? statusPalette.Unavailable;

  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.background }]}>
      <View style={[styles.statusDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.statusText, { color: palette.foreground }]}>{status}</Text>
    </View>
  );
}

function ForecastCard({ item }: { item: WeatherForecast }) {
  return (
    <View style={styles.forecastCard}>
      <Text style={styles.forecastTemp}>{item.temp_max}{'\u00b0'}</Text>
      <WeatherGlyph condition={item.condition} small />
      <Text style={styles.forecastDay}>{item.day}</Text>
    </View>
  );
}

function RiverRow({ station }: { station: RiverStation }) {
  return (
    <View style={styles.riverRow}>
      <View style={styles.stationCell}>
        <PinIcon color="#2d75b4" />
        <Text style={styles.stationName}>{station.station}</Text>
      </View>
      <Text style={styles.levelText}>{formatLevel(station.level)}</Text>
      <StatusBadge status={station.status} />
    </View>
  );
}

export default function HomeDashboard() {
  const { session } = useAuthSession();
  const params = useLocalSearchParams<{
    barangay?: string;
    contactNumber?: string;
    email?: string;
    firstName?: string;
    fullName?: string;
    gender?: string;
    houseNumber?: string;
    lastName?: string;
    middleName?: string;
    streetBlock?: string;
    suffix?: string;
    username?: string;
  }>();
  const fullName = session?.full_name || (typeof params.fullName === 'string' ? params.fullName : 'Juan De La Cruz');
  const barangay = session?.barangay || (typeof params.barangay === 'string' ? params.barangay : '');
  const initialDashboard = getDashboardSnapshot();
  const [weather, setWeather] = useState<WeatherData | null>(() => initialDashboard.weather);
  const [waterLevel, setWaterLevel] = useState<WaterLevelData | null>(() => initialDashboard.waterLevel);
  const [isLoading, setIsLoading] = useState(() => !initialDashboard.weather || !initialDashboard.waterLevel);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => getFirstName(fullName), [fullName]);

  const refreshDashboard = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const data = await refreshDashboardData();
      setWeather(data.weather);
      setWaterLevel(data.waterLevel);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    return subscribeDashboardData(
      (data) => {
        setWeather(data.weather);
        setWaterLevel(data.waterLevel);
        setError(null);
        setIsLoading(false);
      },
      (dashboardError) => {
        setError(dashboardError.message);
        setIsLoading(false);
      }
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshDashboard} />
        }>
        <View style={styles.header}>
          <Image source={iconSources.bantayLogo} style={styles.logoImage} resizeMode="contain" />
          <View style={styles.headerCopy}>
            <Text style={styles.welcome}>Welcome,</Text>
            <Text style={styles.name}>{displayName}!</Text>
          </View>
          <Image source={profileStatic} style={styles.profileImage} />
        </View>

        <View style={styles.quickActions}>
          <Pressable style={[styles.actionPill, styles.evacPill]}>
            <ActionIcon type="evacuation" />
            <Text style={styles.actionText}>Evacuation</Text>
          </Pressable>
          <Pressable style={[styles.actionPill, styles.hotlinePill]}>
            <ActionIcon type="hotlines" />
            <Text style={styles.actionText}>Hotlines</Text>
          </Pressable>
          <Pressable style={[styles.actionPill, styles.tipsPill]}>
            <ActionIcon type="tips" />
            <Text style={styles.actionText}>Safety Tips</Text>
          </Pressable>
        </View>

        {error ? (
          <Pressable style={styles.errorBanner} onPress={refreshDashboard}>
            <Text style={styles.errorTitle}>Live data unavailable</Text>
            <Text style={styles.errorMessage}>{error}. Tap to retry.</Text>
          </Pressable>
        ) : null}

        <View style={styles.weatherPanel}>
          {isLoading && !weather ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <View style={styles.weatherTop}>
                <View>
                  <Text style={styles.todayLabel}>TODAY</Text>
                  <WeatherGlyph condition={weather?.condition} />
                  <View style={styles.locationRow}>
                    <PinIcon color="#ffebeb" />
                    <Text style={styles.locationText}>{weather?.location ?? 'Marikina City'}</Text>
                  </View>
                </View>
                <View style={styles.currentWeather}>
                  <Text style={styles.weatherDate}>{weather?.date ?? 'Today'}</Text>
                  <Text style={styles.temperature}>{weather?.temperature ?? '--'}{'\u00b0'}</Text>
                  <Text style={styles.condition}>{weather?.condition ?? 'Loading weather'}</Text>
                  <Text style={styles.weatherMeta}>
                    H {weather?.humidity ?? '--'}%  W {weather?.windspeed ?? '--'} km/h
                  </Text>
                </View>
              </View>

              <View style={styles.forecastRow}>
                {(weather?.forecast ?? []).map((item) => (
                  <ForecastCard key={item.day} item={item} />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <SectionIcon type="water" />
              <Text style={styles.cardTitle}>River Water Level</Text>
            </View>
            {waterLevel?.updated_at || waterLevel?.last_checked_at ? (
              <Text style={styles.updatedText}>{getSourceLabel(waterLevel.source_status)}</Text>
            ) : null}
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadText, styles.stationColumn]}>STATION</Text>
            <Text style={styles.tableHeadText}>LEVEL</Text>
            <Text style={styles.tableHeadText}>STATUS</Text>
          </View>
          {isLoading && !waterLevel ? (
            <ActivityIndicator color={Colors.light.primary} style={styles.inlineLoader} />
          ) : (
            (waterLevel?.stations ?? []).map((station) => (
              <RiverRow key={station.station} station={station} />
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <SectionIcon type="map" />
              <Text style={styles.cardTitle}>Live Map</Text>
            </View>
            <Pressable>
              <Text style={styles.mapLink}>View Full Map</Text>
            </Pressable>
          </View>
          <Image source={mapStatic} style={styles.mapImage} />
        </View>

        <Text style={styles.footerHint}>{barangay ? `${barangay} resident dashboard` : 'Marikina resident dashboard'}</Text>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <View style={styles.activeIconBubble}>
            <NavIcon name="home" active />
          </View>
          <Text style={styles.activeNavLabel}>Home</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <NavIcon name="map" />
          <Text style={styles.navLabel}>Map</Text>
        </Pressable>
        <Pressable style={[styles.navItem, styles.reportNav]}>
          <View style={styles.reportButton}>
            <NavIcon name="report" active />
          </View>
          <Text style={styles.navLabel}>Report</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <NavIcon name="bell" />
          <Text style={styles.navLabel}>Notification</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => router.push('/profile')}>
          <NavIcon name="user" />
          <Text style={styles.navLabel}>Profile</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 104,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  logoImage: {
    height: 64,
    width: 64,
  },
  headerCopy: {
    flex: 1,
  },
  welcome: {
    color: '#060606',
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    color: Colors.light.primary,
    fontSize: 21,
    fontWeight: '700',
  },
  profileImage: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 9,
  },
  actionPill: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  evacPill: {
    backgroundColor: 'rgba(209, 65, 65, 0.14)',
    borderColor: 'rgba(209, 65, 65, 0.6)',
  },
  hotlinePill: {
    backgroundColor: 'rgba(255, 173, 80, 0.27)',
    borderColor: '#ffad50',
  },
  tipsPill: {
    backgroundColor: 'rgba(238, 201, 30, 0.13)',
    borderColor: 'rgba(238, 201, 30, 0.57)',
  },
  actionText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fff3f3',
    borderColor: '#f1b2b2',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  errorTitle: {
    color: '#a63a3a',
    fontSize: 13,
    fontWeight: '700',
  },
  errorMessage: {
    color: '#7a4b4b',
    fontSize: 11,
    marginTop: 3,
  },
  weatherPanel: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    elevation: 4,
    minHeight: 286,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  weatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  locationText: {
    color: '#ffebeb',
    fontSize: 12,
    fontWeight: '600',
  },
  currentWeather: {
    alignItems: 'center',
    paddingTop: 2,
  },
  weatherDate: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  temperature: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '600',
    lineHeight: 76,
  },
  condition: {
    color: '#ffebeb',
    fontSize: 11,
    fontWeight: '600',
  },
  weatherMeta: {
    color: '#d8ecff',
    fontSize: 10,
    marginTop: 6,
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 18,
  },
  forecastCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(229, 229, 229, 0.12)',
    borderRadius: 5,
    height: 117,
    justifyContent: 'space-between',
    paddingVertical: 7,
    width: 79,
  },
  forecastTemp: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
  forecastDay: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    elevation: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cardTitle: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  updatedText: {
    color: Colors.light.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  tableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tableHeadText: {
    color: Colors.light.primary,
    fontSize: 10,
    fontWeight: '800',
    width: 72,
  },
  stationColumn: {
    flex: 1,
  },
  inlineLoader: {
    paddingVertical: 28,
  },
  riverRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(217, 217, 217, 0.65)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 28,
    paddingVertical: 5,
  },
  stationCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  stationName: {
    color: '#000',
    fontSize: 10,
  },
  levelText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'left',
    width: 72,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    height: 18,
    justifyContent: 'center',
    width: 78,
  },
  statusDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  mapLink: {
    color: '#215582',
    fontSize: 9,
    fontWeight: '800',
  },
  mapImage: {
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 5,
    borderWidth: 1,
    height: 321,
    width: '100%',
  },
  footerHint: {
    color: Colors.light.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 117, 180, 0.92)',
    borderRadius: 50,
    bottom: 24,
    elevation: 6,
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-around',
    left: 24,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  reportNav: {
    marginTop: -26,
  },
  activeIconBubble: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 31,
    justifyContent: 'center',
    width: 38,
  },
  reportButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    elevation: 5,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    width: 56,
  },
  navLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  activeNavLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  weatherIconLarge: {
    height: 82,
    width: 92,
  },
  weatherIconSmall: {
    height: 42,
    width: 50,
  },
  pinIcon: {
    height: 17,
    width: 11,
  },
  sectionIcon: {
    height: 20,
    width: 20,
  },
  navIcon: {
    height: 24,
    width: 24,
  },
  actionIcon: {
    height: 18,
    width: 18,
  },
});
