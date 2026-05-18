import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { OptionModal } from '@/components/auth-modal';
import { AuthScreen } from '@/components/auth-screen';
import { useSignupDraft } from '@/context/signup-context';

const barangayOptions = [
  'Barangka',
  'Calumpang',
  'Concepcion Dos',
  'Concepcion Uno',
  'Fortune',
  'Industrial Valley Complex (IVC)',
  'Jesus Dela Peña',
  'Malanday',
  'Marikina Heights',
  'Nangka',
  'Parang',
  'San Roque',
  'Santa Elena',
  'Santo Niño',
  'Tañong',
  'Tumana',
];

export default function SignupAddressScreen() {
  const { draft, updateDraft } = useSignupDraft();
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const isComplete = Boolean(
    draft.barangay?.trim() && draft.street_block?.trim() && draft.house_number?.trim()
  );

  const requiredError = (value?: string) => (value?.trim() ? undefined : 'Required');

  const handleNext = () => {
    setShowErrors(true);

    if (!isComplete) {
      return;
    }

    router.push('/signup/security');
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <View style={styles.form}>
        <Pressable onPress={() => setShowBarangayModal(true)}>
          <View style={styles.nonInteractive}>
            <AuthField
              editable={false}
              error={showErrors ? requiredError(draft.barangay) : undefined}
              label="Barangay"
              placeholder="Choose barangay"
              required
              value={draft.barangay}
            />
          </View>
        </Pressable>
        <AuthField
          error={showErrors ? requiredError(draft.street_block) : undefined}
          label="Street/Block"
          onChangeText={(street_block) => updateDraft({ street_block })}
          placeholder="eg. Sampaguita St."
          required
          value={draft.street_block}
        />
        <AuthField
          error={showErrors ? requiredError(draft.house_number) : undefined}
          keyboardType="number-pad"
          label="House Number"
          onChangeText={(house_number) => updateDraft({ house_number })}
          placeholder="eg. 115"
          required
          value={draft.house_number}
        />
      </View>
      <View style={styles.actions}>
        <AuthButton title="Previous" variant="text" onPress={() => router.back()} />
        <AuthButton title="Next" style={styles.nextButton} onPress={handleNext} />
      </View>
      <OptionModal
        onClose={() => setShowBarangayModal(false)}
        onSelect={(barangay) => {
          updateDraft({ barangay });
          setShowBarangayModal(false);
        }}
        options={barangayOptions}
        title="Choose Barangay"
        visible={showBarangayModal}
      />
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
  nonInteractive: {
    pointerEvents: 'none',
  },
});
