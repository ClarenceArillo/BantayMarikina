import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors } from '@/constants/theme';

type AuthFieldProps = TextInputProps & {
  label: string;
  rightElement?: React.ReactNode;
};

export function AuthField({ label, rightElement, style, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={Colors.light.placeholder}
          style={[styles.input, rightElement ? styles.inputWithIcon : undefined, style]}
          {...inputProps}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
    marginBottom: 10,
  },
  label: {
    color: Colors.light.black,
    fontSize: 17,
    fontWeight: '500',
  },
  inputWrap: {
    height: 51,
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: Colors.light.border,
    borderRadius: 10,
    backgroundColor: Colors.light.input,
  },
  input: {
    height: '100%',
    paddingHorizontal: 13,
    color: Colors.light.black,
    fontSize: 15,
    fontWeight: '300',
  },
  inputWithIcon: {
    paddingRight: 52,
  },
  rightElement: {
    position: 'absolute',
    right: 13,
    alignSelf: 'center',
  },
});
