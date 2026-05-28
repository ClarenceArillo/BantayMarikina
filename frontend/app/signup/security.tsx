import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthStatusModal } from '@/components/auth-modal';
import { AuthScreen } from '@/components/auth-screen';
import { useAppTheme } from '@/components/EmergencyUI';
import { TERMS_AND_CONDITIONS } from '@/constants/terms';
import { Colors } from '@/constants/theme';
import { useSignupDraft } from '@/context/signup-context';
import { registerUser } from '@/services/authService';

function TermsModal({
  onAccept,
  onClose,
  visible,
}: {
  onAccept: () => void;
  onClose: () => void;
  visible: boolean;
}) {
  const theme = useAppTheme();

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.termsOverlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.termsCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.termsModalTitle, { color: theme.primary }]}>Terms and Conditions</Text>
          <ScrollView
            style={[styles.termsScroll, { borderColor: theme.border }]}
            contentContainerStyle={styles.termsScrollContent}
            showsVerticalScrollIndicator>
            <Text style={[styles.termsBody, { color: theme.text }]}>{TERMS_AND_CONDITIONS}</Text>
          </ScrollView>
          <Pressable style={[styles.okButton, { backgroundColor: theme.primary }]} onPress={onAccept}>
            <Text style={styles.okButtonText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function SignupSecurityScreen() {
  const [agreed, setAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
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
    setShowErrors(true);

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

  const handleTermsPress = () => {
    if (agreed) {
      setAgreed(false);
      return;
    }

    setShowTermsModal(true);
  };

  const handleAcceptTerms = () => {
    setAgreed(true);
    setShowTermsModal(false);
  };

  return (
    <AuthScreen title="Sign Up" logoMode="mark">
      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          error={showErrors ? requiredError(draft.username) : undefined}
          label="Create Username"
          onChangeText={(username) => updateDraft({ username })}
          placeholder="@delacruzjuan1"
          required
          textContentType="username"
          value={draft.username}
        />
        <AuthField
          error={showErrors ? requiredError(draft.password) : undefined}
          label="Create Password"
          onChangeText={(password) => updateDraft({ password })}
          placeholder="********"
          required
          secureTextEntry
          textContentType="newPassword"
          value={draft.password}
        />
        <AuthField
          error={showErrors ? requiredError(draft.confirm_password) : undefined}
          label="Confirm Password"
          onChangeText={(confirm_password) => updateDraft({ confirm_password })}
          placeholder="********"
          required
          secureTextEntry
          textContentType="newPassword"
          value={draft.confirm_password}
        />
      </View>

      <Pressable style={styles.termsRow} onPress={handleTermsPress}>
        <View style={[styles.checkbox, agreed ? styles.checkboxActive : undefined]}>
          {agreed ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.termsText}>I agree to the terms & conditions</Text>
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

      <AuthStatusModal
        buttonTitle={modal?.status === 'success' ? 'Proceed to Log In' : 'Try Again'}
        message={modal?.message}
        onClose={handleModalClose}
        status={modal?.status ?? 'success'}
        title={modal?.title ?? ''}
        visible={Boolean(modal)}
      />
      <TermsModal
        onAccept={handleAcceptTerms}
        onClose={() => setShowTermsModal(false)}
        visible={showTermsModal}
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
    gap: 12,
  },
  checkbox: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderColor: Colors.light.primary,
    borderWidth: 2,
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
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '800',
    textDecorationLine: 'underline',
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
  termsOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  termsCard: {
    borderRadius: 22,
    maxHeight: '82%',
    padding: 18,
    width: '100%',
  },
  termsModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  termsScroll: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 430,
  },
  termsScrollContent: {
    padding: 14,
  },
  termsBody: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  okButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    marginTop: 14,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
