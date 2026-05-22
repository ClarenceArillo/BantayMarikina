import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';
import { useTheme } from '@/theme/useTheme';
import { Radius } from '@/constants/theme';

type BottomNavTab = 'home' | 'map' | 'report' | 'notification' | 'profile';

type BottomNavProps = {
  activeTab: BottomNavTab;
};

const iconSources = {
  home: {
    light: { inactive: require('@/assets/Icons/Home.png'), active: require('@/assets/Icons/Home (2).png') },
    dark: { inactive: require('@/assets/Icons/Home.png'), active: require('@/assets/Icons/Home (2).png') },
  },
  map: {
    light: { inactive: require('@/assets/Icons/Map.png'), active: require('@/assets/Icons/Map (2).png') },
    dark: { inactive: require('@/assets/Icons/Map.png'), active: require('@/assets/Icons/Map (2).png') },
  },
  report: {
    light: { inactive: require('@/assets/Icons/HazardReport.png'), active: require('@/assets/Icons/Report.png') },
    dark: { inactive: require('@/assets/Icons/HazardReport.png'), active: require('@/assets/Icons/Report.png') },
  },
  notification: {
    light: { inactive: require('@/assets/Icons/Notification.png'), active: require('@/assets/Icons/Notification-Active.png') },
    dark: { inactive: require('@/assets/Icons/Notification.png'), active: require('@/assets/Icons/Notification-Active.png') },
  },
  profile: {
    light: { inactive: require('@/assets/Icons/ProfileIcon.png'), active: require('@/assets/Icons/ProfileIcon-Active.png') },
    dark: { inactive: require('@/assets/Icons/ProfileIcon.png'), active: require('@/assets/Icons/ProfileIcon-Active.png') },
  },
};

const routesByTab = {
  home: '/home',
  map: '/map',
  report: '/report',
  notification: '/notification',
  profile: '/profile',
} as const;

function navigate(tab: BottomNavTab) {
  router.replace(routesByTab[tab] as never);
}

function getTabIcon(tab: BottomNavTab, active: boolean, isDark: boolean): ImageSourcePropType {
  const mode = isDark ? 'dark' : 'light';
  const state = active ? 'active' : 'inactive';

  return iconSources[tab][mode][state];
}

function NavIcon({ tab, active }: { tab: BottomNavTab; active: boolean }) {
  const { isDark } = useTheme();

  return <Image source={getTabIcon(tab, active, isDark)} style={styles.navIcon} resizeMode="contain" />;
}

function NavItem({ label, tab, activeTab }: { label: string; tab: BottomNavTab; activeTab: BottomNavTab }) {
  const active = activeTab === tab;
  const theme = useAppTheme();

  if (tab === 'report') {
    return (
      <Pressable style={[styles.navItem, styles.reportNav]} onPress={() => navigate(tab)}>
        <View style={[styles.reportButton, { backgroundColor: theme.surface, borderColor: active ? theme.primaryDark : theme.borderSoft, shadowColor: theme.black }, active ? styles.activeRaisedButton : null]}>
          <NavIcon tab={tab} active={active} />
        </View>
        <Text style={active ? styles.activeNavLabel : styles.navLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.navItem} onPress={() => navigate(tab)} disabled={active}>
      {active ? (
        <View style={[styles.activeIconBubble, { backgroundColor: theme.surface }]}>
          <NavIcon tab={tab} active />
        </View>
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
    <View style={[styles.bottomNav, { backgroundColor: theme.primary, shadowColor: theme.black }]}>
      <NavItem activeTab={activeTab} label="Home" tab="home" />
      <NavItem activeTab={activeTab} label="Map" tab="map" />
      <NavItem activeTab={activeTab} label="Report" tab="report" />
      <NavItem activeTab={activeTab} label="Notification" tab="notification" />
      <NavItem activeTab={activeTab} label="Profile" tab="profile" />
    </View>
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
