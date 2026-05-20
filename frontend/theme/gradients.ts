import type { ThemeName } from './colors';

export function createGradients(mode: ThemeName) {
  const dark = mode === 'dark';

  return {
    primary: dark ? ['#153D61', '#215582', '#0F172A'] : ['#153D61', '#215582', '#43A0C7'],
    emergency: dark ? ['#8F3030', '#215582', '#111827'] : ['#C93535', '#215582', '#153D61'],
    calm: dark ? ['#102236', '#111827'] : ['#FFF5F5', '#F1F7FC'],
    footer: dark ? ['#111827', '#1E293B'] : ['#F1F7FC', '#FFFFFF'],
  } as const;
}
