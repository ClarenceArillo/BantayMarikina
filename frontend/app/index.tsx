import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthScreen } from '@/components/auth-screen';
import { Colors } from '@/constants/theme';
import { loginUser } from '@/services/authService';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier || !password) {
      Alert.alert('Missing details', 'Please enter your email or username and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await loginUser(cleanIdentifier, password);
      Alert.alert('Login successful', `Welcome back, ${user.full_name}.`);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen title="Log In">
      <View style={styles.form}>
        <AuthField
          autoCapitalize="none"
          label="Email or Username"
          onChangeText={setIdentifier}
          placeholder="Your email or username"
          textContentType="username"
          value={identifier}
        />
        <AuthField
          label="Password"
          onChangeText={setPassword}
          placeholder="***********"
          rightElement={
            <Pressable onPress={() => setShowPassword((current) => !current)}>
              <Text style={styles.eye}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          }
          secureTextEntry={!showPassword}
          textContentType="password"
          value={password}
        />
        <Link href="/forgot-password" style={styles.forgot}>
          Forgot Password
        </Link>
        <AuthButton
          disabled={isSubmitting}
          title={isSubmitting ? 'LOGGING IN...' : 'LOGIN'}
          style={styles.loginButton}
          onPress={handleLogin}
        />
      </View>

      <View style={styles.signupPrompt}>
        <Text style={styles.noAccount}>No Account Yet?</Text>
        <Pressable onPress={() => router.push('/signup')}>
          <Text style={styles.signupLink}>SIGN UP</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 11,
  },
  eye: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  forgot: {
    marginTop: -2,
    marginLeft: 11,
    color: Colors.light.primary,
    fontSize: 10,
  },
  loginButton: {
    marginTop: 14,
  },
  signupPrompt: {
    alignItems: 'center',
    marginTop: 46,
    gap: 8,
  },
  noAccount: {
    color: '#000',
    fontSize: 17,
    fontWeight: '300',
  },
  signupLink: {
    color: Colors.light.primary,
    fontSize: 20,
    fontWeight: '700',
  },
});
