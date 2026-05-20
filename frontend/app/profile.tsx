import * as ImagePicker from 'expo-image-picker';
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
import { useAuthSession } from '@/context/auth-context';
import {
  getCurrentUserProfile,
  UserProfileResponse,
  updateCurrentUserProfile,
} from '@/services/authService';
import { ensureFirebaseSession } from '@/services/firebaseSession';
import { uploadUserProfilePhoto } from '@/services/profilePhotoService';

const logo = require('@/assets/Logo/BantayMarikinaLogo.png');
const defaultProfile = require('@/assets/Icons/Default Profile.png');
const cameraIcon = require('@/assets/Icons/Camera.png');
const penIcon = require('@/assets/Icons/Pen.png');

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
  const { profilePhotoUri, session, setProfilePhotoUri, updateSessionProfile } = useAuthSession();
  const idToken = session?.idToken ?? '';
  const fallbackName = session?.full_name ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(() => toForm());
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
        const remoteUri = await uploadUserProfilePhoto(session.uid, localUri);
        setProfilePhotoUri(remoteUri);
      } catch (uploadError) {
        Alert.alert('Photo not saved', uploadError instanceof Error ? uploadError.message : 'Please try again.');
      } finally {
        setIsUploadingPhoto(false);
      }
    }
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
          <Text style={[styles.fullName, { color: theme.text }]}>{fullName}</Text>
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
});
