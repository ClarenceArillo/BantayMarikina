import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';

type AuthButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'text';
};

export function AuthButton({ title, variant = 'primary', style, ...props }: AuthButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        variant === 'primary' ? [styles.primary, { backgroundColor: theme.primary }] : styles.textButton,
        pressed ? styles.pressed : undefined,
        props.disabled ? styles.disabled : undefined,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}>
      <Text style={variant === 'primary' ? styles.primaryText : [styles.textButtonLabel, { color: theme.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  primaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  textButton: {
    minHeight: 51,
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.62,
  },
});
