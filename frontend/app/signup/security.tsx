import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthScreen } from '@/components/auth-screen';
import { Colors } from '@/constants/theme';
import { useSignupDraft } from '@/context/signup-context';
import { registerUser } from '@/services/authService';

export default function SignupSecurityScreen() {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { draft, resetDraft, updateDraft } = useSignupDraft();

  const handleSignup = async () => {
    if (!draft.username.trim() || !draft.password || !draft.confirm_password) {
      Alert.alert('Missing details', 'Please enter a username and password.');
      return;
    }

    if (draft.password !== draft.confirm_password) {
      Alert.alert('Password mismatch', 'Please make sure both passwords match.');
      return;
    }

    if (!agreed) {
      Alert.alert('Terms required', 'Please agree to the terms and conditions to continue.');
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
      resetDraft();
      Alert.alert('Account created', 'You can now log in with your email and password.');
      router.replace('/');
    } catch (error) {
      Alert.alert('Sign up failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          label="Create Username"
          onChangeText={(username) => updateDraft({ username })}
          placeholder="@delacruzjuan1"
          textContentType="username"
          value={draft.username}
        />
        <AuthField
          label="Create Password"
          onChangeText={(password) => updateDraft({ password })}
          placeholder="********"
          secureTextEntry
          textContentType="newPassword"
          value={draft.password}
        />
        <AuthField
          label="Confirm Password"
          onChangeText={(confirm_password) => updateDraft({ confirm_password })}
          placeholder="********"
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
          disabled={isSubmitting}
          title={isSubmitting ? 'Saving...' : 'Continue'}
          style={styles.continueButton}
          onPress={handleSignup}
        />
      </View>
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
