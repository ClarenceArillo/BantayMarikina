import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AppIcon, Badge, EmergencyCard, PressScale, RiskBanner, SectionHeader, SoftCard, ThemeToggle, useAppTheme } from '@/components/EmergencyUI';
import { HazardDetailsSheet } from '@/components/HazardDetailsSheet';
import { HazardMapView } from '@/components/HazardMapView';
import { SafetyTipsModal } from '@/components/SafetyTipsModal';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuthSession } from '@/context/auth-context';
import { useHazardReports } from '@/hooks/useHazardReports';
import { useTheme } from '@/theme/useTheme';
import {
  getDashboardSnapshot,
  refreshDashboardData,
  RiverStation,
  subscribeDashboardData,
  WaterLevelData,
  WeatherData,
  WeatherForecast,
} from '@/services/dashboardService';
import type { HazardReport } from '@/types/hazard';

const defaultProfile = require('@/assets/Icons/Default Profile.png');
const iconSources = {
  bantayLogo: require('@/assets/Icons/BantayLogo.png'),
  cloudyDay: require('@/assets/Icons/CloudyDay.png'),
  evacuation: require('@/assets/Icons/Evacuation.png'),
  hotline: require('@/assets/Icons/Hotline.png'),
  mapActive: require('@/assets/Icons/Map (2).png'),
  pin: require('@/assets/Icons/Pin.png'),
  rainyDay: require('@/assets/Icons/RainyDay.png'),
  safetyTips: require('@/assets/Icons/SafetyTips.png'),
  sunnyDay: require('@/assets/Icons/SunnyDay.png'),
  water: require('@/assets/Icons/Water.png'),
};

const statusPalette = {
  Normal: { tone: 'green', dot: '#2e7d55' },
  Warning: { tone: 'yellow', dot: '#b7791f' },
  Critical: { tone: 'red', dot: '#c93535' },
  Unavailable: { tone: 'neutral', dot: '#98a2b3' },
} as const;

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
  if (sourceStatus === 'no_readings') return 'No reading';
  return sourceStatus === 'ok' ? 'Live' : 'Source offline';
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
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('thunder')) return iconSources.rainyDay;
  if (lower.includes('cloud') || lower.includes('overcast') || lower.includes('fog')) return iconSources.cloudyDay;
  return iconSources.sunnyDay;
}

function WeatherGlyph({ condition, small = false }: { condition?: string; small?: boolean }) {
  return (
    <AssetIcon source={getWeatherIcon(condition)} style={small ? styles.weatherIconSmall : styles.weatherIconLarge} />
  );
}

function PinIcon({ color = Colors.light.danger }: { color?: string }) {
  return <AssetIcon source={iconSources.pin} style={styles.pinIcon} tintColor={color} />;
}

function StatusBadge({ status }: { status: RiverStation['status'] }) {
  const palette = statusPalette[status as keyof typeof statusPalette] ?? statusPalette.Unavailable;

  return (
    <View style={styles.statusWrap}>
      <View style={[styles.statusDot, { backgroundColor: palette.dot }]} />
      <Badge label={status} tone={palette.tone} style={styles.statusBadge} />
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
  const theme = useAppTheme();

  return (
    <View style={[styles.riverRow, { borderBottomColor: theme.borderSoft }]}>
      <View style={styles.stationCell}>
        <PinIcon color={theme.primary} />
        <Text style={[styles.stationName, { color: theme.text }]} numberOfLines={1}>{station.station}</Text>
      </View>
      <Text style={[styles.levelText, { color: theme.text }]}>{formatLevel(station.level)} m</Text>
      <StatusBadge status={station.status} />
    </View>
  );
}

function SkeletonLine({ width = '100%' }: { width?: number | `${number}%` }) {
  const theme = useAppTheme();
  return <View style={[styles.skeletonLine, { backgroundColor: theme.borderSoft, width }]} />;
}

export default function HomeDashboard() {
  const theme = useAppTheme();
  const { isDark } = useTheme();
  const { profilePhotoUri, session } = useAuthSession();
  const params = useLocalSearchParams<{
    barangay?: string;
    fullName?: string;
  }>();
  const fullName = session?.full_name || (typeof params.fullName === 'string' ? params.fullName : 'Juan De La Cruz');
  const barangay = session?.barangay || (typeof params.barangay === 'string' ? params.barangay : '');
  const initialDashboard = getDashboardSnapshot();
  const [weather, setWeather] = useState<WeatherData | null>(() => initialDashboard.weather);
  const [waterLevel, setWaterLevel] = useState<WaterLevelData | null>(() => initialDashboard.waterLevel);
  const [isLoading, setIsLoading] = useState(() => !initialDashboard.weather || !initialDashboard.waterLevel);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [isSafetyTipsVisible, setIsSafetyTipsVisible] = useState(false);
  const { reports: hazardReports, isLoading: isMapLoading, error: mapError } = useHazardReports(session?.idToken, 150);

  const displayName = useMemo(() => getFirstName(fullName), [fullName]);
  const openMap = useCallback(() => router.push('/map' as never), []);
  const openEvacuationMap = useCallback(() => router.push({ pathname: '/map', params: { evacuation: '1' } } as never), []);
  const openHotlines = useCallback(() => router.push('/hotline' as never), []);
  const emergencyLevel = useMemo(() => {
    if ((waterLevel?.stations ?? []).some((station) => station.status === 'Critical')) return 'Critical';
    if ((waterLevel?.stations ?? []).some((station) => station.status === 'Warning')) return 'Warning';
    return 'Normal';
  }, [waterLevel?.stations]);

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshDashboard} tintColor={theme.primary} />}>
        <Animated.View entering={FadeInUp.duration(420)} style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={iconSources.bantayLogo} style={styles.logoImage} resizeMode="contain" />
            <View style={styles.headerCopy}>
              <Text style={[styles.welcome, { color: theme.muted }]}>Good day,</Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle />
            <Image source={profilePhotoUri ? { uri: profilePhotoUri } : defaultProfile} style={[styles.profileImage, { borderColor: theme.borderSoft }]} />
          </View>
        </Animated.View>

        <RiskBanner
          level={emergencyLevel}
          title={`${emergencyLevel} emergency level`}
          message="Live city conditions are monitored for floods, weather, and active hazards."
        />

        <View style={styles.quickActions}>
          <QuickAction icon={iconSources.evacuation} label="Evacuation" tone="red" onPress={openEvacuationMap} />
          <QuickAction icon={iconSources.hotline} label="Hotlines" tone="orange" onPress={openHotlines} />
          <QuickAction icon={iconSources.safetyTips} label="Safety Tips" tone="yellow" onPress={() => setIsSafetyTipsVisible(true)} />
        </View>

        {error ? (
          <PressScale style={[styles.errorBanner, { backgroundColor: theme.dangerSoft }]} onPress={refreshDashboard}>
            <Text style={[styles.errorTitle, { color: theme.danger }]}>Live data unavailable</Text>
            <Text style={[styles.errorMessage, { color: theme.muted }]}>{error}. Tap to retry.</Text>
          </PressScale>
        ) : null}

        <EmergencyCard colors={isDark ? ['#153d61', '#215582', '#0f172a'] : ['#153d61', '#215582', '#43a0c7']} delay={80} style={styles.weatherPanel}>
          {isLoading && !weather ? (
            <View style={styles.weatherSkeleton}>
              <ActivityIndicator color="#fff" />
              <SkeletonLine width="48%" />
              <SkeletonLine width="74%" />
            </View>
          ) : (
            <>
              <View style={styles.weatherTop}>
                <View style={styles.weatherLeft}>
                  <Text style={styles.todayLabel}>MARIKINA TODAY</Text>
                  <WeatherGlyph condition={weather?.condition} />
                  <View style={styles.locationRow}>
                    <PinIcon color="#eaf6ff" />
                    <Text style={styles.locationText}>{weather?.location ?? 'Marikina City'}</Text>
                  </View>
                </View>
                <View style={styles.currentWeather}>
                  <Text style={styles.weatherDate}>{weather?.date ?? 'Today'}</Text>
                  <Text style={styles.temperature}>{weather?.temperature ?? '--'}{'\u00b0'}</Text>
                  <Text style={styles.condition}>{weather?.condition ?? 'Loading weather'}</Text>
                  <Text style={styles.weatherMeta}>Humidity {weather?.humidity ?? '--'}%  Wind {weather?.windspeed ?? '--'} km/h</Text>
                </View>
              </View>

              <View style={styles.forecastRow}>
                {(weather?.forecast ?? []).slice(0, 3).map((item) => (
                  <ForecastCard key={item.day} item={item} />
                ))}
              </View>
            </>
          )}
        </EmergencyCard>

        <SoftCard delay={120}>
          <SectionHeader
            icon={iconSources.water}
            title="River Water Level"
            subtitle="Fast scan of monitored stations"
            action={waterLevel?.updated_at || waterLevel?.last_checked_at ? <Badge label={getSourceLabel(waterLevel.source_status)} /> : null}
          />
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadText, styles.stationColumn, { color: theme.muted }]}>Station</Text>
            <Text style={[styles.tableHeadText, { color: theme.muted }]}>Level</Text>
            <Text style={[styles.tableHeadText, { color: theme.muted }]}>Status</Text>
          </View>
          {isLoading && !waterLevel ? (
            <View style={styles.inlineSkeleton}>
              <SkeletonLine />
              <SkeletonLine width="82%" />
              <SkeletonLine width="68%" />
            </View>
          ) : (
            (waterLevel?.stations ?? []).map((station) => <RiverRow key={station.station} station={station} />)
          )}
        </SoftCard>

        <SoftCard delay={160} style={styles.mapCard}>
          <SectionHeader
            icon={iconSources.mapActive}
            title="Live Hazard Map"
            subtitle={`${hazardReports.length} active reports nearby`}
            action={
              <PressScale onPress={openMap} style={[styles.viewButton, { backgroundColor: theme.primaryTint }]}>
                <Text style={[styles.viewButtonText, { color: theme.primary }]}>Open</Text>
              </PressScale>
            }
          />
          <View style={styles.mapPreview}>
            <HazardMapView
              reports={hazardReports}
              pinSource={iconSources.pin}
              isLoading={isMapLoading}
              error={mapError}
              height={300}
              compact
              onMarkerPress={setSelectedReport}
              onMapPress={openMap}
            />
          </View>
        </SoftCard>

        <PressScale onPress={openHotlines} style={styles.hotlineAccess}>
          <LinearGradient colors={isDark ? ['#111827', '#1e293b'] : ['#fff5f5', '#f1f7fc']} style={[styles.hotlineAccessGradient, { borderColor: theme.borderSoft }]}>
            <View style={[styles.hotlineIcon, { backgroundColor: theme.surface }]}>
              <AppIcon source={iconSources.hotline} size={24} />
            </View>
            <View style={styles.hotlineCopy}>
              <Text style={[styles.hotlineTitle, { color: theme.text }]}>Emergency Hotlines</Text>
              <Text style={[styles.hotlineSubtitle, { color: theme.muted }]}>Marikina Rescue and office contacts</Text>
            </View>
            <Badge label="8-161" tone="red" />
          </LinearGradient>
        </PressScale>

        <Text style={[styles.footerHint, { color: theme.muted }]}>
          {barangay ? `${barangay} resident dashboard` : 'Marikina resident dashboard'}
        </Text>
      </ScrollView>

      <HazardDetailsSheet report={selectedReport} onClose={() => setSelectedReport(null)} />
      <SafetyTipsModal visible={isSafetyTipsVisible} onClose={() => setIsSafetyTipsVisible(false)} />
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: ImageSourcePropType;
  label: string;
  tone: 'red' | 'orange' | 'yellow';
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const tones = {
    red: [theme.dangerSoft, theme.danger],
    orange: [theme.orangeSoft, theme.orange],
    yellow: [theme.warningSoft, theme.warning],
  } as const;
  const [backgroundColor, color] = tones[tone];

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.actionWrap}>
      <PressScale onPress={onPress} style={[styles.actionPill, { backgroundColor }]}>
        <AppIcon source={icon} size={22} />
        <Text style={[styles.actionText, { color }]}>{label}</Text>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    gap: Spacing.xl,
    paddingBottom: 114,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  logoImage: {
    height: 58,
    width: 58,
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  welcome: {
    fontSize: Typography.body,
    fontWeight: '800',
  },
  name: {
    fontSize: Typography.headline,
    fontWeight: '900',
    letterSpacing: 0,
  },
  profileImage: {
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    width: 48,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionWrap: {
    flex: 1,
  },
  actionPill: {
    alignItems: 'center',
    borderRadius: Radius.lg,
    flexDirection: 'column',
    gap: Spacing.sm,
    height: 82,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  actionText: {
    fontSize: Typography.caption,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorBanner: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  errorTitle: {
    fontSize: Typography.body,
    fontWeight: '900',
  },
  errorMessage: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 4,
  },
  weatherPanel: {
    minHeight: 292,
  },
  weatherSkeleton: {
    gap: Spacing.md,
    minHeight: 220,
    justifyContent: 'center',
  },
  weatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weatherLeft: {
    flex: 0.9,
  },
  todayLabel: {
    color: '#ffffff',
    fontSize: Typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: Spacing.md,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.sm,
  },
  locationText: {
    color: '#eaf6ff',
    flex: 1,
    fontSize: Typography.caption,
    fontWeight: '800',
  },
  currentWeather: {
    alignItems: 'flex-end',
    flex: 1,
  },
  weatherDate: {
    color: '#ffffff',
    fontSize: Typography.body,
    fontWeight: '800',
  },
  temperature: {
    color: '#ffffff',
    fontSize: 62,
    fontWeight: '800',
    lineHeight: 72,
  },
  condition: {
    color: '#eaf6ff',
    fontSize: Typography.body,
    fontWeight: '800',
    textAlign: 'right',
  },
  weatherMeta: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  forecastRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  forecastCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 112,
    paddingVertical: Spacing.md,
  },
  forecastTemp: {
    color: '#ffffff',
    fontSize: Typography.title,
    fontWeight: '900',
  },
  forecastDay: {
    color: '#ffffff',
    fontSize: Typography.body,
    fontWeight: '900',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  tableHeadText: {
    fontSize: Typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    width: 82,
  },
  stationColumn: {
    flex: 1,
  },
  inlineSkeleton: {
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  skeletonLine: {
    borderRadius: Radius.pill,
    height: 14,
  },
  riverRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingVertical: Spacing.sm,
  },
  stationCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  stationName: {
    flex: 1,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  levelText: {
    fontSize: Typography.body,
    fontWeight: '900',
    width: 82,
  },
  statusWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    width: 96,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusBadge: {
    flex: 1,
    minHeight: 28,
    paddingHorizontal: 0,
  },
  mapCard: {
    overflow: 'hidden',
    paddingBottom: Spacing.lg,
  },
  viewButton: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  viewButtonText: {
    fontSize: Typography.body,
    fontWeight: '900',
  },
  mapPreview: {
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  hotlineAccess: {
    borderRadius: Radius.xl,
  },
  hotlineAccessGradient: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 78,
    padding: Spacing.lg,
  },
  hotlineIcon: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  hotlineCopy: {
    flex: 1,
  },
  hotlineTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
  },
  hotlineSubtitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 3,
  },
  footerHint: {
    fontSize: Typography.caption,
    fontWeight: '700',
    textAlign: 'center',
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
});
