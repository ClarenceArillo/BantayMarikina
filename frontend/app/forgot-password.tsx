import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthScreen } from '@/components/auth-screen';
import { Colors } from '@/constants/theme';
import { sendPasswordReset } from '@/services/authService';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert('Missing email', 'Please enter your account email.');
      return;
    }

    try {
      setIsSubmitting(true);
      await sendPasswordReset(cleanEmail);
      Alert.alert('Reset email sent', 'Please check your inbox for password reset instructions.');
    } catch (error) {
      Alert.alert('Reset failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen title="Forgot Password">
      <View style={styles.form}>
        <Text style={styles.helperText}>
          Enter the email linked to your Bantay Marikina account and we will send password reset
          instructions.
        </Text>
        <AuthField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="Your email"
          textContentType="emailAddress"
          value={email}
        />
        <AuthButton
          disabled={isSubmitting}
          title={isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
          style={styles.button}
          onPress={handleReset}
        />
        <Link href="/" style={styles.backLink}>
          Back to Log In
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  helperText: {
    marginBottom: 10,
    color: Colors.light.muted,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 23,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
  },
  backLink: {
    marginTop: 18,
    color: Colors.light.primary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});
