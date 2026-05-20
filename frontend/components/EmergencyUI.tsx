import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/theme/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function useAppTheme() {
  return useTheme().colors;
}

export function ThemeToggle() {
  const { colors, isDark, toggleTheme } = useTheme();
  const translate = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    translate.value = withSpring(isDark ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [isDark, translate]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value * 28 }],
  }));

  return (
    <PressScale
      accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onPress={toggleTheme}
      style={[
        styles.themeToggle,
        {
          backgroundColor: isDark ? colors.surfaceMuted : colors.primaryTint,
          borderColor: colors.borderSoft,
        },
      ]}>
      <Text style={[styles.themeToggleIcon, { color: isDark ? colors.mutedSoft : colors.warning }]}>L</Text>
      <Text style={[styles.themeToggleIcon, { color: isDark ? colors.primary : colors.mutedSoft }]}>D</Text>
      <Animated.View
        style={[
          styles.themeToggleThumb,
          {
            backgroundColor: isDark ? colors.primary : colors.surface,
            shadowColor: colors.black,
          },
          thumbStyle,
        ]}
      />
    </PressScale>
  );
}

export function AppIcon({
  source,
  size = 22,
  tintColor,
}: {
  source: ImageSourcePropType;
  size?: number;
  tintColor?: string;
}) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ height: size, tintColor, width: size }}
    />
  );
}

export function PressScale({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 240 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 240 });
      }}
      style={[animatedStyle, style]}>
      {children}
    </AnimatedPressable>
  );
}

export function SoftCard({
  children,
  style,
  delay = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const theme = useAppTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(420).springify()}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.borderSoft,
          shadowColor: theme.black,
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
  style,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();

  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleWrap}>
        {icon ? (
          <View style={[styles.sectionIcon, { backgroundColor: theme.primaryTint }]}>
            <AppIcon source={icon} size={18} tintColor={theme.primary} />
          </View>
        ) : null}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {action}
    </View>
  );
}

export function RiskBanner({
  title,
  message,
  level = 'Normal',
}: {
  title: string;
  message: string;
  level?: 'Normal' | 'Warning' | 'Critical';
}) {
  const colors: [string, string, ...string[]] =
    level === 'Critical'
      ? ['#c93535', '#215582']
      : level === 'Warning'
        ? ['#e0792f', '#215582']
        : ['#215582', '#2f85b8'];

  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.riskBanner}>
      <View style={styles.riskDotWrap}>
        <View style={styles.riskDot} />
      </View>
      <View style={styles.riskCopy}>
        <Text style={styles.riskTitle}>{title}</Text>
        <Text style={styles.riskMessage}>{message}</Text>
      </View>
      <Text style={styles.riskLevel}>{level}</Text>
    </LinearGradient>
  );
}

export function EmergencyCard({
  children,
  colors = ['#215582', '#2f85b8'],
  style,
  delay = 0,
}: {
  children: ReactNode;
  colors?: [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420).springify()}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.emergencyCard, style]}>
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

export function Badge({
  label,
  tone = 'blue',
  style,
  textStyle,
}: {
  label: string;
  tone?: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'neutral';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const theme = useAppTheme();
  const palette = {
    blue: [theme.primaryTint, theme.primary],
    green: [theme.successSoft, theme.success],
    red: [theme.dangerSoft, theme.danger],
    yellow: [theme.warningSoft, theme.warning],
    orange: [theme.orangeSoft, theme.orange],
    neutral: [theme.surfaceMuted, theme.muted],
  } as const;
  const [backgroundColor, color] = palette[tone];

  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <Text style={[styles.badgeText, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

export const modernShadow = {
  elevation: 8,
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.12,
  shadowRadius: 22,
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    elevation: 5,
    padding: Spacing.lg,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitleWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionTitle: {
    fontSize: Typography.title,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  riskBanner: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    elevation: 8,
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 88,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
  },
  riskDotWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  riskDot: {
    backgroundColor: '#65d889',
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  riskCopy: {
    flex: 1,
  },
  riskTitle: {
    color: '#ffffff',
    fontSize: Typography.bodyLarge,
    fontWeight: '900',
  },
  riskMessage: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: Typography.caption,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
  },
  riskLevel: {
    color: '#ffffff',
    fontSize: Typography.caption,
    fontWeight: '900',
  },
  emergencyCard: {
    borderRadius: Radius.xl,
    elevation: 8,
    overflow: 'hidden',
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  badge: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  badgeText: {
    fontSize: Typography.caption,
    fontWeight: '900',
  },
  themeToggle: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    position: 'relative',
    width: 72,
  },
  themeToggleIcon: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
    zIndex: 2,
  },
  themeToggleThumb: {
    borderRadius: 14,
    elevation: 4,
    height: 28,
    left: 3,
    position: 'absolute',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    top: 3,
    width: 38,
    zIndex: 1,
  },
});
