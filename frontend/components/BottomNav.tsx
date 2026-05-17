import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

type BottomNavTab = 'home' | 'map' | 'report' | 'notification' | 'profile';

type BottomNavProps = {
  activeTab: BottomNavTab;
};

const iconSources = {
  alert: require('@/assets/Icons/Alert.png'),
  home: require('@/assets/Icons/Home.png'),
  homeActive: require('@/assets/Icons/Home (2).png'),
  map: require('@/assets/Icons/Map.png'),
  mapActive: require('@/assets/Icons/Map (2).png'),
  notification: require('@/assets/Icons/Notification.png'),
  notificationActive: require('@/assets/Icons/Notification (2).png'),
  profile: require('@/assets/Icons/Profile.png'),
  profileActive: require('@/assets/Icons/Profile (2).png'),
};

const routesByTab = {
  home: '/home',
  map: '/map',
  report: '/report',
  profile: '/profile',
} as const;

function navigate(tab: BottomNavTab) {
  if (tab === 'notification') return;

  router.replace(routesByTab[tab] as never);
}

function NavIcon({ tab, active }: { tab: BottomNavTab; active: boolean }) {
  const sourceByTab = {
    home: active ? iconSources.homeActive : iconSources.home,
    map: active ? iconSources.mapActive : iconSources.map,
    notification: active ? iconSources.notificationActive : iconSources.notification,
    profile: active ? iconSources.profileActive : iconSources.profile,
    report: iconSources.alert,
  };

  return <Image source={sourceByTab[tab]} style={styles.navIcon} resizeMode="contain" />;
}

function NavItem({ label, tab, activeTab }: { label: string; tab: BottomNavTab; activeTab: BottomNavTab }) {
  const active = activeTab === tab;

  if (tab === 'report') {
    return (
      <Pressable style={[styles.navItem, styles.reportNav]} onPress={() => navigate(tab)}>
        <View style={[styles.reportButton, active ? styles.activeRaisedButton : null]}>
          <NavIcon tab={tab} active={active} />
        </View>
        <Text style={active ? styles.activeNavLabel : styles.navLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.navItem} onPress={() => navigate(tab)} disabled={active}>
      {active ? (
        <View style={styles.activeIconBubble}>
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
  return (
    <View style={styles.bottomNav}>
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
    backgroundColor: 'rgba(45, 117, 180, 0.92)',
    borderRadius: 50,
    bottom: 24,
    elevation: 6,
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-around',
    left: 18,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 18,
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
  activeRaisedButton: {
    borderColor: Colors.light.primaryDark,
    borderWidth: 2,
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
  navIcon: {
    height: 24,
    width: 24,
  },
});
