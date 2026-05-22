import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomNav } from '@/components/BottomNav';
import { useAppTheme } from '@/components/EmergencyUI';
import { getFirebaseClients } from '@/config/firebase';
import { useAuthSession } from '@/context/auth-context';
import {
  changeCurrentPassword,
  getCurrentUserProfile,
  updateCurrentUsername,
  UserProfileResponse,
  updateCurrentUserProfile,
} from '@/services/authService';
import { ensureFirebaseSession } from '@/services/firebaseSession';
import { removeUserProfilePhoto, uploadUserProfilePhoto } from '@/services/profilePhotoService';

const logo = require('@/assets/Logo/BantayMarikinaLogo.png');
const defaultProfile = require('@/assets/Icons/Default Profile.png');
const cameraIcon = require('@/assets/Icons/Camera.png');
const penIcon = require('@/assets/Icons/EditIcon.png');

type ProfileForm = {
  barangay: string;
  contactNumber: string;
  email: string;
  firstName: string;
  gender: string;
  houseNumber: string;
  lastName: string;
  middleName: string;
  streetBlock: string;
  suffix: string;
};

function toForm(profile?: UserProfileResponse): ProfileForm {
  return {
    barangay: profile?.profile.address?.barangay ?? profile?.profile.barangay ?? '',
    contactNumber: profile?.profile.contact_number ?? '',
    email: profile?.profile.email ?? '',
    firstName: profile?.profile.name?.first ?? '',
    gender: profile?.profile.gender ?? '',
    houseNumber: profile?.profile.address?.house_number ?? '',
    lastName: profile?.profile.name?.last ?? '',
    middleName: profile?.profile.name?.middle ?? '',
    streetBlock: profile?.profile.address?.street_block ?? '',
    suffix: profile?.profile.name?.suffix ?? '',
  };
}

function buildFullName(form: ProfileForm, fallback: string) {
  const fullName = [form.firstName, form.middleName, form.lastName, form.suffix]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');

  return fullName || fallback || 'Juan De La Cruz';
}

function ProfileField({
  editable,
  keyboardType,
  label,
  onChangeText,
  required = false,
  value,
}: {
  editable: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  label: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.text }]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={theme.placeholder}
        style={[
          styles.input,
          {
            backgroundColor: editable ? theme.surface : theme.input,
            borderColor: editable ? theme.primary : theme.border,
            color: theme.text,
          },
        ]}
        value={value}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { profilePhotoUri, session, setProfilePhotoUri, setSession, updateSessionProfile } = useAuthSession();
  const idToken = session?.idToken ?? '';
  const fallbackName = session?.full_name ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(() => toForm());
  const [username, setUsername] = useState(session?.username || '');
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const fullName = useMemo(() => buildFullName(form, fallbackName), [fallbackName, form]);
  const profileSource: ImageSourcePropType = profilePhotoUri ? { uri: profilePhotoUri } : defaultProfile;

  const updateField = (field: keyof ProfileForm) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const loadProfile = useCallback(async () => {
    if (!idToken) {
      setError('Secure profile session is unavailable.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const profile = await getCurrentUserProfile(idToken);
      setForm(toForm(profile));
      setUsername(profile.username || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load profile.');
    } finally {
      setIsLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Gallery permission needed', 'Please allow photo access to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const localUri = result.assets[0].uri;
      setProfilePhotoUri(localUri);

      if (!idToken || !session?.uid) {
        Alert.alert('Photo not saved', 'Secure profile session is unavailable.');
        return;
      }

      try {
        setIsUploadingPhoto(true);
        await ensureFirebaseSession(idToken);
        const remoteUri = await uploadUserProfilePhoto(session.uid, idToken, localUri, setUploadProgress);
        setProfilePhotoUri(remoteUri);
      } catch (uploadError) {
        Alert.alert('Photo not saved', uploadError instanceof Error ? uploadError.message : 'Please try again.');
      } finally {
        setIsUploadingPhoto(false);
        setUploadProgress(0);
      }
    }
  };

  const removeProfilePhoto = () => {
    if (!idToken || !session?.uid || !profilePhotoUri) return;
    Alert.alert('Remove profile picture?', 'Your account will use the default profile image.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsUploadingPhoto(true);
            await ensureFirebaseSession(idToken);
            await removeUserProfilePhoto(session.uid, idToken);
            setProfilePhotoUri('');
          } catch (removeError) {
            Alert.alert('Photo not removed', removeError instanceof Error ? removeError.message : 'Please try again.');
          } finally {
            setIsUploadingPhoto(false);
          }
        },
      },
    ]);
  };

  const saveProfile = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    if (!idToken) {
      Alert.alert('Profile not saved', 'Secure profile session is unavailable.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateCurrentUserProfile(idToken, {
        barangay: form.barangay,
        contact_number: form.contactNumber,
        email: form.email,
        first_name: form.firstName,
        gender: form.gender,
        house_number: form.houseNumber,
        last_name: form.lastName,
        middle_name: form.middleName,
        street_block: form.streetBlock,
        suffix: form.suffix,
      });
      updateSessionProfile(updated);
      setForm(toForm(updated));
      setIsEditing(false);
    } catch (requestError) {
      Alert.alert('Profile not saved', requestError instanceof Error ? requestError.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveUsername = async () => {
    if (!idToken) return;
    try {
      setIsSaving(true);
      const updated = await updateCurrentUsername(idToken, username.trim());
      updateSessionProfile(updated);
      setUsername(updated.username);
      Alert.alert('Username updated', 'Your new username is now live across the app.');
    } catch (requestError) {
      Alert.alert('Username not saved', requestError instanceof Error ? requestError.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const passwordStrengthError = useMemo(() => {
    if (!passwordForm.next) return '';
    if (passwordForm.next.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Z]/.test(passwordForm.next) || !/[a-z]/.test(passwordForm.next) || !/[0-9]/.test(passwordForm.next)) {
      return 'Use uppercase, lowercase, and a number.';
    }
    if (passwordForm.next !== passwordForm.confirm) return 'Passwords do not match.';
    return '';
  }, [passwordForm.confirm, passwordForm.next]);

  const savePassword = () => {
    if (!idToken || passwordStrengthError) {
      Alert.alert('Password not ready', passwordStrengthError || 'Secure profile session is unavailable.');
      return;
    }

    Alert.alert('Change password?', 'You will need this new password the next time you log in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change',
        onPress: async () => {
          try {
            setIsSaving(true);
            await changeCurrentPassword(idToken, {
              current_password: passwordForm.current,
              new_password: passwordForm.next,
              confirm_password: passwordForm.confirm,
            });
            setPasswordForm({ current: '', next: '', confirm: '' });
            Alert.alert('Password changed', 'Your Firebase Auth password was updated securely.');
          } catch (requestError) {
            Alert.alert('Password not changed', requestError instanceof Error ? requestError.message : 'Please try again.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const logout = () => {
    Alert.alert('Log out?', 'Your live listeners will close and this device will return to login.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await getFirebaseClients().auth.signOut().catch(() => undefined);
          if (session?.uid) {
            await AsyncStorage.removeItem(`bantay.profile.photo.${session.uid}`).catch(() => undefined);
          }
          setProfilePhotoUri('');
          setSession(null);
          router.replace('/' as never);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />

        <View style={styles.profileHeader}>
          <View style={styles.photoWrap}>
            <Image source={profileSource} style={[styles.profilePhoto, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]} resizeMode="cover" />
            <Pressable style={[styles.photoButton, { backgroundColor: theme.primary, borderColor: theme.background }]} onPress={pickProfilePhoto} disabled={isUploadingPhoto}>
              {isUploadingPhoto ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Image source={cameraIcon} style={styles.photoButtonIcon} resizeMode="contain" />
              )}
            </Pressable>
          </View>
          {isUploadingPhoto && uploadProgress ? (
            <Text style={[styles.uploadText, { color: theme.primary }]}>Uploading {uploadProgress}%</Text>
          ) : null}
          <Text style={[styles.fullName, { color: theme.text }]}>{fullName}</Text>
          <Text style={[styles.usernameText, { color: theme.muted }]}>@{session?.username || username || 'resident'}</Text>
        </View>

        <Pressable style={styles.editButton} onPress={saveProfile} disabled={isSaving || isLoading}>
          <Image source={penIcon} style={[styles.editIcon, { tintColor: theme.primary }]} resizeMode="contain" />
          <Text style={[styles.editText, { color: theme.primary }]}>{isEditing ? 'Save' : 'Edit'}</Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color={theme.primary} style={styles.loader} />
        ) : (
          <>
            {error ? (
              <Pressable style={[styles.errorBox, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]} onPress={loadProfile}>
                <Text style={[styles.errorText, { color: theme.danger }]}>{error} Tap to retry.</Text>
              </Pressable>
            ) : null}

            <View style={styles.form}>
              <ProfileField editable={isEditing} label="First Name" onChangeText={updateField('firstName')} required value={form.firstName} />
              <ProfileField editable={isEditing} label="Middle Name" onChangeText={updateField('middleName')} value={form.middleName} />
              <ProfileField editable={isEditing} label="Last Name" onChangeText={updateField('lastName')} required value={form.lastName} />
              <ProfileField editable={isEditing} label="Suffix" onChangeText={updateField('suffix')} value={form.suffix} />
              <ProfileField editable={isEditing} label="Gender" onChangeText={updateField('gender')} required value={form.gender} />
              <ProfileField
                editable={isEditing}
                keyboardType="phone-pad"
                label="Contact Number"
                onChangeText={updateField('contactNumber')}
                required
                value={form.contactNumber}
              />
              <ProfileField
                editable={isEditing}
                keyboardType="email-address"
                label="Email"
                onChangeText={updateField('email')}
                required
                value={form.email}
              />
              <ProfileField editable={isEditing} label="Barangay" onChangeText={updateField('barangay')} required value={form.barangay} />
              <ProfileField editable={isEditing} label="Street/Block" onChangeText={updateField('streetBlock')} required value={form.streetBlock} />
              <ProfileField editable={isEditing} label="House Number" onChangeText={updateField('houseNumber')} required value={form.houseNumber} />
            </View>

            <Pressable style={[styles.nextButton, { backgroundColor: theme.primary }]} onPress={saveProfile} disabled={isSaving}>
              <Text style={styles.nextText}>{isSaving ? 'Saving...' : isEditing ? 'Save' : 'Next'}</Text>
            </Pressable>

            <View style={[styles.settingsCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
              <Text style={[styles.settingsTitle, { color: theme.text }]}>Account Settings</Text>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Username</Text>
                <View style={styles.inlineRow}>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setUsername}
                    placeholderTextColor={theme.placeholder}
                    style={[styles.compactInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
                    value={username}
                  />
                  <Pressable style={[styles.smallButton, { backgroundColor: theme.primary }]} onPress={saveUsername} disabled={isSaving}>
                    <Text style={styles.smallButtonText}>Save</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.passwordHeader}>
                  <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                  <Pressable onPress={() => setShowPasswords((current) => !current)}>
                    <Text style={[styles.linkText, { color: theme.primary }]}>{showPasswords ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
                <TextInput
                  onChangeText={(value) => setPasswordForm((current) => ({ ...current, current: value }))}
                  placeholder="Current password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showPasswords}
                  style={[styles.compactInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
                  value={passwordForm.current}
                />
                <TextInput
                  onChangeText={(value) => setPasswordForm((current) => ({ ...current, next: value }))}
                  placeholder="New password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showPasswords}
                  style={[styles.compactInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
                  value={passwordForm.next}
                />
                <TextInput
                  onChangeText={(value) => setPasswordForm((current) => ({ ...current, confirm: value }))}
                  placeholder="Confirm new password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showPasswords}
                  style={[styles.compactInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
                  value={passwordForm.confirm}
                />
                {passwordStrengthError ? <Text style={[styles.helperText, { color: theme.danger }]}>{passwordStrengthError}</Text> : null}
                <Pressable style={[styles.outlineButton, { borderColor: theme.primary }]} onPress={savePassword} disabled={isSaving}>
                  <Text style={[styles.outlineText, { color: theme.primary }]}>Change Password</Text>
                </Pressable>
              </View>

              <View style={styles.inlineRow}>
                <Pressable style={[styles.outlineButton, styles.flexButton, { borderColor: theme.danger }]} onPress={removeProfilePhoto} disabled={isUploadingPhoto || !profilePhotoUri}>
                  <Text style={[styles.outlineText, { color: theme.danger }]}>Remove Photo</Text>
                </Pressable>
                <Pressable style={[styles.logoutButton, styles.flexButton, { backgroundColor: theme.danger }]} onPress={logout}>
                  <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav activeTab="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingBottom: 104,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  logo: {
    alignSelf: 'center',
    height: 53,
    width: 155,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 6,
  },
  photoWrap: {
    height: 98,
    width: 98,
  },
  profilePhoto: {
    borderWidth: 1,
    borderRadius: 49,
    height: 98,
    width: 98,
  },
  photoButton: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 3,
    bottom: 2,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 34,
  },
  photoButtonIcon: {
    height: 17,
    tintColor: '#fff',
    width: 17,
  },
  fullName: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  usernameText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  uploadText: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 8,
  },
  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    marginRight: 5,
    marginTop: 15,
  },
  editIcon: {
    height: 16,
    width: 16,
  },
  editText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    marginTop: 36,
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    gap: 10,
    marginTop: 6,
  },
  fieldGroup: {
    gap: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  required: {
    color: '#f03a3a',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 18,
    height: 80,
    paddingHorizontal: 20,
  },
  nextButton: {
    alignItems: 'center',
    borderRadius: 4,
    height: 42,
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  nextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginTop: 18,
    padding: 14,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  compactInput: {
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    alignItems: 'center',
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  passwordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '900',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '800',
  },
  outlineButton: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  outlineText: {
    fontSize: 12,
    fontWeight: '900',
  },
  flexButton: {
    flex: 1,
  },
  logoutButton: {
    alignItems: 'center',
    borderRadius: 13,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
});
