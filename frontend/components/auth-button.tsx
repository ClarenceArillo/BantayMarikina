import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Colors } from '@/constants/theme';

type AuthButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'text';
};

export function AuthButton({ title, variant = 'primary', style, ...props }: AuthButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        variant === 'primary' ? styles.primary : styles.textButton,
        pressed ? styles.pressed : undefined,
        props.disabled ? styles.disabled : undefined,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
      ]}
      {...props}>
      <Text style={variant === 'primary' ? styles.primaryText : styles.textButtonLabel}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
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
    color: Colors.light.black,
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
