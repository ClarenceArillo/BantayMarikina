import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth-button';
import { AuthField } from '@/components/auth-field';
import { AuthStatusModal } from '@/components/auth-modal';
import { AuthScreen } from '@/components/auth-screen';
import { Colors } from '@/constants/theme';
import { useAuthSession } from '@/context/auth-context';
import { LoginResponse, loginUser } from '@/services/authService';

export default function LoginScreen() {
  const { setSession } = useAuthSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [modal, setModal] = useState<{
    message?: string;
    status: 'success' | 'error';
    title: string;
  } | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<LoginResponse | null>(null);

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier || !password) {
      setModal({
        status: 'error',
        title: 'Login Failed',
        message: 'Please enter your email or username and password.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await loginUser(cleanIdentifier, password);
      setSession(user);
      setLoggedInUser(user);
      setModal({
        status: 'success',
        title: 'Successful',
        message: 'Login successful.',
      });
    } catch (error) {
      setModal({
        status: 'error',
        title: 'Login Failed',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (modal?.status === 'success' && loggedInUser) {
      const user = loggedInUser;
      setModal(null);
      setLoggedInUser(null);
      router.replace({
        pathname: '/home',
        params: {
          fullName: user.full_name,
          firstName: user.profile?.name?.first ?? '',
          middleName: user.profile?.name?.middle ?? '',
          lastName: user.profile?.name?.last ?? '',
          suffix: user.profile?.name?.suffix ?? '',
          gender: user.profile?.gender ?? '',
          contactNumber: user.profile?.contact_number ?? '',
          email: user.profile?.email ?? '',
          barangay: user.barangay ?? user.profile?.address?.barangay ?? '',
          streetBlock: user.profile?.address?.street_block ?? '',
          houseNumber: user.profile?.address?.house_number ?? '',
          username: user.username ?? '',
        },
      });
      return;
    }

    setModal(null);
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

      <AuthStatusModal
        buttonTitle={modal?.status === 'success' ? 'Proceed' : 'Try Again'}
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
