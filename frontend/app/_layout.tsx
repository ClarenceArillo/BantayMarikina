import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthSessionProvider } from '@/context/auth-context';
import { SignupProvider } from '@/context/signup-context';

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <SignupProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="map" />
          <Stack.Screen name="report" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="signup/index" />
          <Stack.Screen name="signup/address" />
          <Stack.Screen name="signup/security" />
        </Stack>
        <StatusBar style="dark" />
      </SignupProvider>
    </AuthSessionProvider>
  );
}
