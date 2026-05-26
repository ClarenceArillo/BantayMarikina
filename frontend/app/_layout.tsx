import { Asset } from 'expo-asset';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BottomNav } from '@/components/BottomNav';
import { AuthSessionProvider } from '@/context/auth-context';
import { SignupProvider } from '@/context/signup-context';
import { preloadIconAssets } from '@/constants/icons';
import { AppThemeProvider, useTheme } from '@/theme/ThemeProvider';

type MainTab = 'home' | 'map' | 'report' | 'notification' | 'profile';

function getActiveTab(pathname: string): MainTab | null {
  const route = pathname.replace(/^\//, '').split('/')[0];
  if (route === 'home' || route === 'map' || route === 'report' || route === 'notification' || route === 'profile') {
    return route;
  }
  return null;
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthSessionProvider>
        <SignupProvider>
          <ThemedStack />
        </SignupProvider>
      </AuthSessionProvider>
    </AppThemeProvider>
  );
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const activeTab = getActiveTab(usePathname());

  useEffect(() => {
    Asset.loadAsync(preloadIconAssets).catch(() => undefined);
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
        <Stack.Screen name="hotline" />
        <Stack.Screen name="map" />
        <Stack.Screen name="report" />
        <Stack.Screen name="notification" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup/index" />
        <Stack.Screen name="signup/address" />
        <Stack.Screen name="signup/security" />
      </Stack>
      {activeTab ? <BottomNav activeTab={activeTab} /> : null}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
