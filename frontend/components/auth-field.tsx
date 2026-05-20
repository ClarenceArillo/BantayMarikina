import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/components/EmergencyUI';

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
  const theme = useAppTheme();

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {required ? <Text style={styles.requiredMark}>*</Text> : null}
      </View>
      <View style={[styles.inputWrap, { backgroundColor: theme.input, borderColor: error ? theme.danger : theme.border }]}>
        <TextInput
          placeholderTextColor={theme.placeholder}
          style={[
            styles.input,
            { color: theme.text },
            rightElement ? styles.inputWithIcon : undefined,
            style,
          ]}
          {...inputProps}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
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
    fontSize: 17,
    fontWeight: '500',
  },
  inputWrap: {
    height: 51,
    justifyContent: 'center',
    borderWidth: 0.5,
    borderRadius: 10,
  },
  input: {
    height: '100%',
    paddingHorizontal: 13,
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
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: -3,
  },
});
