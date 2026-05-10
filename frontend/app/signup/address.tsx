import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthScreen } from '@/components/auth-screen';
import { useSignupDraft } from '@/context/signup-context';

export default function SignupAddressScreen() {
  const { draft, updateDraft } = useSignupDraft();

  const handleNext = () => {
    if (!draft.barangay?.trim()) {
      Alert.alert('Missing details', 'Please enter your barangay.');
      return;
    }

    router.push('/signup/security');
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <View style={styles.form}>
        <AuthField
          label="Barangay"
          onChangeText={(barangay) => updateDraft({ barangay })}
          placeholder="eg. San Juan"
          value={draft.barangay}
        />
        <AuthField
          label="Street/Block"
          onChangeText={(street_block) => updateDraft({ street_block })}
          placeholder="eg. Sampaguita St."
          value={draft.street_block}
        />
        <AuthField
          keyboardType="number-pad"
          label="House Number"
          onChangeText={(house_number) => updateDraft({ house_number })}
          placeholder="eg. 115"
          value={draft.house_number}
        />
      </View>
      <View style={styles.actions}>
        <AuthButton title="Previous" variant="text" onPress={() => router.back()} />
        <AuthButton title="Next" style={styles.nextButton} onPress={handleNext} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  nextButton: {
    width: 125,
  },
});
