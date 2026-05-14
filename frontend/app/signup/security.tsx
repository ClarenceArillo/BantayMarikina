import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthStatusModal } from '@/components/auth-modal';
import { AuthScreen } from '@/components/auth-screen';
import { Colors } from '@/constants/theme';
import { useSignupDraft } from '@/context/signup-context';
import { registerUser } from '@/services/authService';

export default function SignupSecurityScreen() {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{
    message?: string;
    status: 'success' | 'error';
    title: string;
  } | null>(null);
  const { draft, resetDraft, updateDraft } = useSignupDraft();

  const isComplete = Boolean(
    draft.username.trim() && draft.password && draft.confirm_password && agreed
  );

  const requiredError = (value?: string) => (value?.trim() ? undefined : 'Required');

  const handleSignup = async () => {
    if (!isComplete) {
      setModal({
        status: 'error',
        title: 'Sign Up Failed',
        message: 'Please complete the required fields and agree to the terms.',
      });
      return;
    }

    if (draft.password !== draft.confirm_password) {
      setModal({
        status: 'error',
        title: 'Password Mismatch',
        message: 'Please make sure both passwords match.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await registerUser({
        ...draft,
        first_name: draft.first_name.trim(),
        middle_name: draft.middle_name?.trim(),
        last_name: draft.last_name.trim(),
        suffix: draft.suffix?.trim(),
        gender: draft.gender?.trim(),
        contact_number: draft.contact_number?.trim(),
        email: draft.email.trim().toLowerCase(),
        barangay: draft.barangay?.trim(),
        street_block: draft.street_block?.trim(),
        house_number: draft.house_number?.trim(),
        username: draft.username.trim(),
      });
      setModal({
        status: 'success',
        title: 'Successful',
        message: 'Your account has been created.',
      });
    } catch (error) {
      setModal({
        status: 'error',
        title: 'Sign Up Failed',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (modal?.status === 'success') {
      setModal(null);
      resetDraft();
      router.replace('/');
      return;
    }

    setModal(null);
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          error={requiredError(draft.username)}
          label="Create Username"
          onChangeText={(username) => updateDraft({ username })}
          placeholder="@delacruzjuan1"
          required
          textContentType="username"
          value={draft.username}
        />
        <AuthField
          error={requiredError(draft.password)}
          label="Create Password"
          onChangeText={(password) => updateDraft({ password })}
          placeholder="********"
          required
          secureTextEntry
          textContentType="newPassword"
          value={draft.password}
        />
        <AuthField
          error={requiredError(draft.confirm_password)}
          label="Confirm Password"
          onChangeText={(confirm_password) => updateDraft({ confirm_password })}
          placeholder="********"
          required
          secureTextEntry
          textContentType="newPassword"
          value={draft.confirm_password}
        />
      </View>

      <Pressable style={styles.termsRow} onPress={() => setAgreed((current) => !current)}>
        <View style={[styles.checkbox, agreed ? styles.checkboxActive : undefined]}>
          {agreed ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.termsText}>I agree to the terms &amp; conditions</Text>
      </Pressable>

      <View style={styles.actions}>
        <AuthButton title="Previous" variant="text" onPress={() => router.back()} />
        <AuthButton
          disabled={isSubmitting || !isComplete}
          title={isSubmitting ? 'Saving...' : 'Continue'}
          style={styles.continueButton}
          onPress={handleSignup}
        />
      </View>

      <AuthStatusModal
        buttonTitle={modal?.status === 'success' ? 'Proceed to Log In' : 'Try Again'}
        message={modal?.message}
        onClose={handleModalClose}
        status={modal?.status ?? 'success'}
        title={modal?.title ?? ''}
        visible={Boolean(modal)}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 20,
  },
  checkbox: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.light.border,
  },
  checkboxActive: {
    backgroundColor: Colors.light.primary,
  },
  check: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  termsText: {
    color: Colors.light.placeholder,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  continueButton: {
    width: 125,
  },
});
