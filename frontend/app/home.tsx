import { useLocalSearchParams } from 'expo-router';
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

import { Colors } from '@/constants/theme';
import {
  getWaterLevels,
  getWeather,
  RiverStation,
  WaterLevelData,
  WeatherData,
  WeatherForecast,
} from '@/services/dashboardService';

const mapStatic = require('@/assets/statics/map-static.png');
const profileStatic = require('@/assets/statics/pfp.png');

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

function WeatherGlyph({ condition, small = false }: { condition?: string; small?: boolean }) {
  const lower = condition?.toLowerCase() ?? '';
  const isRain = lower.includes('rain') || lower.includes('drizzle') || lower.includes('thunder');
  const isCloudy = lower.includes('cloud') || lower.includes('overcast') || lower.includes('fog');
  const size = small ? 42 : 82;

  return (
    <View style={[styles.weatherGlyph, { width: size, height: size }]}>
      {!isRain ? <View style={[styles.sunCore, small && styles.sunCoreSmall]} /> : null}
      {isCloudy || isRain ? (
        <>
          <View style={[styles.cloudBubbleLarge, small && styles.cloudBubbleSmall]} />
          <View style={[styles.cloudBubbleMedium, small && styles.cloudBubbleMediumSmall]} />
          <View style={[styles.cloudBase, small && styles.cloudBaseSmall]} />
        </>
      ) : null}
      {isRain ? (
        <View style={styles.rainDrops}>
          <View style={styles.rainDrop} />
          <View style={styles.rainDrop} />
          <View style={styles.rainDrop} />
        </View>
      ) : null}
    </View>
  );
}

function PinIcon({ color = Colors.light.primary }: { color?: string }) {
  return (
    <View style={styles.pinIcon}>
      <View style={[styles.pinHead, { borderColor: color }]}>
        <View style={[styles.pinDot, { backgroundColor: color }]} />
      </View>
      <View style={[styles.pinTail, { borderTopColor: color }]} />
    </View>
  );
}

function RiverIcon() {
  return (
    <View style={styles.riverIcon}>
      <View style={styles.riverWave} />
      <View style={[styles.riverWave, styles.riverWaveLower]} />
    </View>
  );
}

function SimpleIcon({ name, active = false }: { name: string; active?: boolean }) {
  const color = active ? Colors.light.primary : '#f5fbff';

  if (name === 'home') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.homeRoof, { borderBottomColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]} />
      </View>
    );
  }

  if (name === 'map') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.mapFold, { borderColor: color }]} />
        <View style={[styles.mapPin, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'bell') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.bellDome, { borderColor: color }]} />
        <View style={[styles.bellClapper, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'user') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.userHead, { borderColor: color }]} />
        <View style={[styles.userBody, { borderColor: color }]} />
      </View>
    );
  }

  return (
    <View style={styles.iconBox}>
      <View style={[styles.reportDiamond, { borderColor: color }]} />
      <View style={[styles.reportLine, { backgroundColor: color }]} />
    </View>
  );
}

function ActionIcon({ type }: { type: 'evacuation' | 'hotlines' | 'tips' }) {
  if (type === 'hotlines') {
    return (
      <View style={styles.actionIcon}>
        <View style={styles.phoneArc} />
        <View style={styles.phoneBase} />
      </View>
    );
  }

  if (type === 'tips') {
    return (
      <View style={styles.actionIcon}>
        <View style={styles.shieldTop} />
        <View style={styles.shieldBottom} />
      </View>
    );
  }

  return (
    <View style={styles.actionIcon}>
      <View style={styles.evacRoof} />
      <View style={styles.evacDoor} />
    </View>
  );
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
  const params = useLocalSearchParams<{ fullName?: string; barangay?: string }>();
  const fullName = typeof params.fullName === 'string' ? params.fullName : 'Juan De La Cruz';
  const barangay = typeof params.barangay === 'string' ? params.barangay : '';
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [waterLevel, setWaterLevel] = useState<WaterLevelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => getFirstName(fullName), [fullName]);

  const loadDashboard = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const [weatherData, waterData] = await Promise.all([getWeather(), getWaterLevels()]);
      setWeather(weatherData);
      setWaterLevel(waterData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadDashboard(true)} />
        }>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <RiverIcon />
          </View>
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
          <Pressable style={styles.errorBanner} onPress={() => loadDashboard()}>
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
              <RiverIcon />
              <Text style={styles.cardTitle}>River Water Level</Text>
            </View>
            {waterLevel?.updated_at ? (
              <Text style={styles.updatedText}>Live</Text>
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
              <SimpleIcon name="map" />
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
            <SimpleIcon name="home" active />
          </View>
          <Text style={styles.activeNavLabel}>Home</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <SimpleIcon name="map" />
          <Text style={styles.navLabel}>Map</Text>
        </Pressable>
        <Pressable style={[styles.navItem, styles.reportNav]}>
          <View style={styles.reportButton}>
            <SimpleIcon name="report" active />
          </View>
          <Text style={styles.navLabel}>Report</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <SimpleIcon name="bell" />
          <Text style={styles.navLabel}>Notification</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <SimpleIcon name="user" />
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
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#eef7ff',
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    width: 58,
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
  weatherGlyph: {
    position: 'relative',
  },
  sunCore: {
    backgroundColor: '#ffd35a',
    borderRadius: 34,
    height: 68,
    left: 6,
    position: 'absolute',
    top: 4,
    width: 68,
  },
  sunCoreSmall: {
    borderRadius: 18,
    height: 36,
    left: 3,
    top: 1,
    width: 36,
  },
  cloudBubbleLarge: {
    backgroundColor: '#f7fbff',
    borderRadius: 22,
    height: 44,
    left: 14,
    position: 'absolute',
    top: 23,
    width: 44,
  },
  cloudBubbleSmall: {
    borderRadius: 12,
    height: 24,
    left: 8,
    top: 13,
    width: 24,
  },
  cloudBubbleMedium: {
    backgroundColor: '#dfefff',
    borderRadius: 18,
    height: 36,
    left: 38,
    position: 'absolute',
    top: 30,
    width: 36,
  },
  cloudBubbleMediumSmall: {
    borderRadius: 10,
    height: 20,
    left: 21,
    top: 17,
    width: 20,
  },
  cloudBase: {
    backgroundColor: '#f7fbff',
    borderRadius: 16,
    height: 29,
    left: 12,
    position: 'absolute',
    top: 46,
    width: 66,
  },
  cloudBaseSmall: {
    borderRadius: 9,
    height: 17,
    left: 6,
    top: 26,
    width: 34,
  },
  rainDrops: {
    flexDirection: 'row',
    gap: 8,
    left: 20,
    position: 'absolute',
    top: 60,
  },
  rainDrop: {
    backgroundColor: '#bfe7ff',
    borderRadius: 4,
    height: 14,
    transform: [{ rotate: '18deg' }],
    width: 4,
  },
  pinIcon: {
    alignItems: 'center',
    height: 17,
    justifyContent: 'center',
    width: 12,
  },
  pinHead: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 2,
    height: 12,
    justifyContent: 'center',
    width: 12,
  },
  pinDot: {
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  pinTail: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 4,
    borderRightColor: 'transparent',
    borderRightWidth: 4,
    borderTopWidth: 7,
    marginTop: -2,
  },
  riverIcon: {
    height: 20,
    justifyContent: 'center',
    width: 22,
  },
  riverWave: {
    borderColor: Colors.light.primary,
    borderRadius: 10,
    borderTopWidth: 3,
    height: 9,
    transform: [{ rotate: '-4deg' }],
    width: 22,
  },
  riverWaveLower: {
    marginTop: -4,
    opacity: 0.7,
  },
  iconBox: {
    alignItems: 'center',
    height: 23,
    justifyContent: 'center',
    width: 26,
  },
  homeRoof: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 10,
    borderRightColor: 'transparent',
    borderRightWidth: 10,
    borderBottomWidth: 10,
    height: 0,
    width: 0,
  },
  homeBody: {
    borderRadius: 3,
    borderWidth: 2,
    height: 12,
    marginTop: -1,
    width: 17,
  },
  mapFold: {
    borderRadius: 3,
    borderWidth: 2,
    height: 17,
    width: 21,
  },
  mapPin: {
    borderRadius: 4,
    height: 8,
    marginTop: -12,
    width: 8,
  },
  bellDome: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 2,
    height: 16,
    width: 17,
  },
  bellClapper: {
    borderRadius: 3,
    height: 5,
    marginTop: -1,
    width: 5,
  },
  userHead: {
    borderRadius: 7,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  userBody: {
    borderBottomWidth: 0,
    borderRadius: 9,
    borderWidth: 2,
    height: 9,
    marginTop: 1,
    width: 20,
  },
  reportDiamond: {
    borderRadius: 4,
    borderWidth: 2,
    height: 19,
    transform: [{ rotate: '45deg' }],
    width: 19,
  },
  reportLine: {
    borderRadius: 1,
    height: 10,
    marginTop: -15,
    width: 2,
  },
  actionIcon: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  phoneArc: {
    borderColor: '#111',
    borderLeftWidth: 3,
    borderRadius: 8,
    borderTopWidth: 3,
    height: 14,
    transform: [{ rotate: '-45deg' }],
    width: 14,
  },
  phoneBase: {
    backgroundColor: '#111',
    borderRadius: 2,
    height: 5,
    marginTop: -8,
    transform: [{ rotate: '-45deg' }],
    width: 9,
  },
  shieldTop: {
    backgroundColor: '#111',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: 10,
    width: 15,
  },
  shieldBottom: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 7,
    borderRightColor: 'transparent',
    borderRightWidth: 7,
    borderTopColor: '#111',
    borderTopWidth: 8,
  },
  evacRoof: {
    borderBottomColor: '#111',
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderLeftWidth: 9,
    borderRightColor: 'transparent',
    borderRightWidth: 9,
  },
  evacDoor: {
    backgroundColor: '#111',
    height: 9,
    width: 14,
  },
});
