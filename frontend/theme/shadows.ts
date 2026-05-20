import type { ThemeName } from './colors';

export function createShadows(mode: ThemeName) {
  const dark = mode === 'dark';

  return {
    card: {
      elevation: dark ? 2 : 5,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: dark ? 0.24 : 0.09,
      shadowRadius: 20,
    },
    floating: {
      elevation: dark ? 8 : 12,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: dark ? 0.32 : 0.18,
      shadowRadius: 24,
    },
    modal: {
      elevation: 18,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: dark ? 0.42 : 0.22,
      shadowRadius: 14,
    },
  } as const;
}
