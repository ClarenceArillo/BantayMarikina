import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthSessionProvider } from '@/context/auth-context';
import { SignupProvider } from '@/context/signup-context';
import { AppThemeProvider, useTheme } from '@/theme/ThemeProvider';

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
        <Stack.Screen name="profile" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup/index" />
        <Stack.Screen name="signup/address" />
        <Stack.Screen name="signup/security" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
