import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthScreen } from '@/components/auth-screen';
import { useSignupDraft } from '@/context/signup-context';

export default function SignupProfileScreen() {
  const { draft, updateDraft } = useSignupDraft();

  const handleNext = () => {
    if (!draft.first_name.trim() || !draft.last_name.trim() || !draft.email.trim()) {
      Alert.alert('Missing details', 'Please enter your first name, last name, and email.');
      return;
    }

    router.push('/signup/address');
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AuthField
          label="First Name"
          onChangeText={(first_name) => updateDraft({ first_name })}
          placeholder="eg. Juan"
          textContentType="givenName"
          value={draft.first_name}
        />
        <AuthField
          label="Middle Name"
          onChangeText={(middle_name) => updateDraft({ middle_name })}
          placeholder="eg. Reyes"
          value={draft.middle_name}
        />
        <AuthField
          label="Last Name"
          onChangeText={(last_name) => updateDraft({ last_name })}
          placeholder="eg. De La Cruz"
          textContentType="familyName"
          value={draft.last_name}
        />
        <AuthField
          label="Suffix"
          onChangeText={(suffix) => updateDraft({ suffix })}
          placeholder="eg. Jr."
          value={draft.suffix}
        />
        <AuthField
          label="Gender"
          onChangeText={(gender) => updateDraft({ gender })}
          placeholder="Male"
          value={draft.gender}
        />
        <AuthField
          keyboardType="phone-pad"
          label="Contact Number"
          onChangeText={(contact_number) => updateDraft({ contact_number })}
          placeholder="09123456789"
          textContentType="telephoneNumber"
          value={draft.contact_number}
        />
        <AuthField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => updateDraft({ email })}
          placeholder="eg. delacruzJuan1@gmail.com"
          textContentType="emailAddress"
          value={draft.email}
        />
        <AuthButton title="Next" style={styles.nextButton} onPress={handleNext} />
      </ScrollView>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 42,
  },
  nextButton: {
    marginTop: 10,
  },
});
