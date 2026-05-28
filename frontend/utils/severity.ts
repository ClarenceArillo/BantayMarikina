import type { ThemeColors } from '@/theme/colors';

export type SeverityTone = 'critical' | 'high' | 'moderate' | 'low';

export function getSeverityTone(severity?: string | null): SeverityTone {
  const normalized = String(severity || '').trim().toLowerCase();

  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'moderate') return 'moderate';
  return 'low';
}

export function getSeverityStyle(theme: ThemeColors, severity?: string | null) {
  const tone = getSeverityTone(severity);

  if (tone === 'critical') {
    return {
      tone,
      color: theme.danger,
      backgroundColor: theme.dangerSoft,
      borderColor: theme.danger,
    };
  }

  if (tone === 'high') {
    return {
      tone,
      color: theme.orange,
      backgroundColor: theme.orangeSoft,
      borderColor: theme.orange,
    };
  }

  if (tone === 'moderate') {
    return {
      tone,
      color: theme.warning,
      backgroundColor: theme.warningSoft,
      borderColor: theme.warning,
    };
  }

  return {
    tone,
    color: theme.muted,
    backgroundColor: theme.surfaceMuted,
    borderColor: theme.border,
  };
}
