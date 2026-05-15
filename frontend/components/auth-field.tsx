import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors } from '@/constants/theme';

type AuthFieldProps = TextInputProps & {
  error?: string;
  label: string;
  required?: boolean;
  rightElement?: React.ReactNode;
};

export function AuthField({
  error,
  label,
  required = false,
  rightElement,
  style,
  ...inputProps
}: AuthFieldProps) {
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.requiredMark}>*</Text> : null}
      </View>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : undefined]}>
        <TextInput
          placeholderTextColor={Colors.light.placeholder}
          style={[
            styles.input,
            rightElement ? styles.inputWithIcon : undefined,
            style,
          ]}
          {...inputProps}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
    marginBottom: 10,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
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
  inputWrapError: {
    borderColor: '#d53939',
    borderWidth: 1,
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
  requiredMark: {
    color: '#d53939',
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: '#d53939',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -3,
  },
});
