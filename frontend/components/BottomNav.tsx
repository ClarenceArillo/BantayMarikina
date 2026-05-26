import { Image, Pressable, StyleSheet, Text } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useAppTheme } from '@/components/EmergencyUI';
import { Icons } from '@/constants/icons';
import { navigateMainTab, type MainTabRoute } from '@/services/mainTabNavigation';
import { useTheme } from '@/theme/useTheme';
import { Radius } from '@/constants/theme';

type BottomNavProps = {
  activeTab: MainTabRoute;
};

const iconSources = {
  home: {
    light: { inactive: Icons.home, active: Icons.homeActive },
    dark: { inactive: Icons.home, active: Icons.homeActive },
  },
  map: {
    light: { inactive: Icons.map, active: Icons.mapActive },
    dark: { inactive: Icons.map, active: Icons.mapActive },
  },
  report: {
    light: { inactive: Icons.reportInactive, active: Icons.report },
    dark: { inactive: Icons.reportInactive, active: Icons.report },
  },
  notification: {
    light: { inactive: Icons.notification, active: Icons.notificationActive },
    dark: { inactive: Icons.notification, active: Icons.notificationActive },
  },
  profile: {
    light: { inactive: Icons.profile, active: Icons.profileActive },
    dark: { inactive: Icons.profile, active: Icons.profileActive },
  },
};

function getTabIcon(tab: MainTabRoute, active: boolean, isDark: boolean): ImageSourcePropType {
  const mode = isDark ? 'dark' : 'light';
  const state = active ? 'active' : 'inactive';

  return iconSources[tab][mode][state];
}

function NavIcon({ tab, active }: { tab: MainTabRoute; active: boolean }) {
  const { isDark } = useTheme();

  return (
    <Animated.View key={`${tab}-${active ? 'active' : 'inactive'}`} entering={FadeIn.duration(140)} exiting={FadeOut.duration(90)}>
      <Image source={getTabIcon(tab, active, isDark)} style={styles.navIcon} resizeMode="contain" fadeDuration={0} />
    </Animated.View>
  );
}

function NavItem({ label, tab, activeTab }: { label: string; tab: MainTabRoute; activeTab: MainTabRoute }) {
  const active = activeTab === tab;
  const theme = useAppTheme();

  if (tab === 'report') {
    return (
      <Pressable style={[styles.navItem, styles.reportNav]} onPress={() => navigateMainTab(activeTab, tab)} disabled={active}>
        <Animated.View
          layout={LinearTransition.springify().damping(18)}
          style={[styles.reportButton, { backgroundColor: theme.surface, borderColor: active ? theme.primaryDark : theme.borderSoft, shadowColor: theme.black }, active ? styles.activeRaisedButton : null]}>
          <NavIcon tab={tab} active={active} />
        </Animated.View>
        <Text style={active ? styles.activeNavLabel : styles.navLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.navItem} onPress={() => navigateMainTab(activeTab, tab)} disabled={active}>
      {active ? (
        <Animated.View layout={LinearTransition.springify().damping(18)} style={[styles.activeIconBubble, { backgroundColor: theme.surface }]}>
          <NavIcon tab={tab} active />
        </Animated.View>
      ) : (
        <NavIcon tab={tab} active={false} />
      )}
      <Text style={active ? styles.activeNavLabel : styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({ activeTab }: BottomNavProps) {
  const theme = useAppTheme();

  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} style={[styles.bottomNav, { backgroundColor: theme.primary, shadowColor: theme.black }]}>
      <NavItem activeTab={activeTab} label="Home" tab="home" />
      <NavItem activeTab={activeTab} label="Map" tab="map" />
      <NavItem activeTab={activeTab} label="Report" tab="report" />
      <NavItem activeTab={activeTab} label="Notification" tab="notification" />
      <NavItem activeTab={activeTab} label="Profile" tab="profile" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    bottom: 24,
    elevation: 12,
    flexDirection: 'row',
    height: 66,
    justifyContent: 'space-around',
    left: 18,
    paddingHorizontal: 8,
    position: 'absolute',
    right: 18,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    zIndex: 100,
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
    borderRadius: 18,
    height: 34,
    justifyContent: 'center',
    width: 42,
  },
  reportButton: {
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: 1,
    elevation: 9,
    height: 60,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    width: 60,
  },
  activeRaisedButton: {
    borderWidth: 2,
  },
  navLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 9,
    fontWeight: '700',
  },
  activeNavLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  navIcon: {
    height: 24,
    width: 24,
  },
});
