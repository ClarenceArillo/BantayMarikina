import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type ThemeColors, type ThemeName } from './colors';
import { createGradients } from './gradients';
import { createShadows } from './shadows';
import { radius, spacing } from './spacing';
import { typography } from './typography';

export type ThemePreference = ThemeName | 'system';

const THEME_STORAGE_KEY = 'bantay.theme.preference';

type AppTheme = {
  colors: ThemeColors;
  gradients: ReturnType<typeof createGradients>;
  isDark: boolean;
  mode: ThemeName;
  preference: ThemePreference;
  radius: typeof radius;
  shadows: ReturnType<typeof createShadows>;
  spacing: typeof spacing;
  typography: typeof typography;
  setThemePreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<AppTheme | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('light');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreference(stored);
        }
      })
      .finally(() => setIsHydrated(true));
  }, []);

  const mode: ThemeName = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextPreference).catch(() => undefined);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((current) => {
      const resolved = current === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : current;
      const nextPreference: ThemePreference = resolved === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, nextPreference).catch(() => undefined);
      return nextPreference;
    });
  }, [systemScheme]);

  const value = useMemo<AppTheme>(
    () => ({
      colors: palette[mode],
      gradients: createGradients(mode),
      isDark: mode === 'dark',
      mode,
      preference,
      radius,
      shadows: createShadows(mode),
      spacing,
      typography,
      setThemePreference,
      toggleTheme,
    }),
    [mode, preference, setThemePreference, toggleTheme]
  );

  if (!isHydrated) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside AppThemeProvider');
  }

  return context;
}
