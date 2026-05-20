import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { OptionModal } from '@/components/auth-modal';
import { AuthScreen } from '@/components/auth-screen';
import { useSignupDraft } from '@/context/signup-context';

const genderOptions = ['Male', 'Female', 'Rather not say'];

export default function SignupProfileScreen() {
  const { draft, updateDraft } = useSignupDraft();
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const isComplete = Boolean(
    draft.first_name.trim() &&
      draft.last_name.trim() &&
      draft.gender?.trim() &&
      draft.contact_number?.trim() &&
      draft.email.trim()
  );

  const requiredError = (value?: string) => (value?.trim() ? undefined : 'Required');

  const handleNext = () => {
    setShowErrors(true);

    if (!isComplete) {
      return;
    }

    router.push('/signup/address');
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AuthField
          error={showErrors ? requiredError(draft.first_name) : undefined}
          label="First Name"
          onChangeText={(first_name) => updateDraft({ first_name })}
          placeholder="eg. Juan"
          required
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
          error={showErrors ? requiredError(draft.last_name) : undefined}
          label="Last Name"
          onChangeText={(last_name) => updateDraft({ last_name })}
          placeholder="eg. De La Cruz"
          required
          textContentType="familyName"
          value={draft.last_name}
        />
        <AuthField
          label="Suffix"
          onChangeText={(suffix) => updateDraft({ suffix })}
          placeholder="eg. Jr."
          value={draft.suffix}
        />
        <Pressable onPress={() => setShowGenderModal(true)}>
          <View style={styles.nonInteractive}>
            <AuthField
              editable={false}
              error={showErrors ? requiredError(draft.gender) : undefined}
              label="Gender"
              placeholder="Choose gender"
              required
              value={draft.gender}
            />
          </View>
        </Pressable>
        <AuthField
          error={showErrors ? requiredError(draft.contact_number) : undefined}
          keyboardType="phone-pad"
          label="Contact Number"
          onChangeText={(contact_number) => updateDraft({ contact_number })}
          placeholder="09123456789"
          required
          textContentType="telephoneNumber"
          value={draft.contact_number}
        />
        <AuthField
          autoCapitalize="none"
          error={showErrors ? requiredError(draft.email) : undefined}
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => updateDraft({ email })}
          placeholder="eg. delacruzJuan1@gmail.com"
          required
          textContentType="emailAddress"
          value={draft.email}
        />
        <AuthButton title="Next" style={styles.nextButton} onPress={handleNext} />
      </ScrollView>
      <OptionModal
        onClose={() => setShowGenderModal(false)}
        onSelect={(gender) => {
          updateDraft({ gender });
          setShowGenderModal(false);
        }}
        options={genderOptions}
        title="Choose Gender"
        visible={showGenderModal}
      />
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
  nonInteractive: {
    pointerEvents: 'none',
  },
});
