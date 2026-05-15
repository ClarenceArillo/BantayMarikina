import * as ImagePicker from 'expo-image-picker';
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

import { Colors } from '@/constants/theme';
import { useAuthSession } from '@/context/auth-context';
import {
  getCurrentUserProfile,
  UserProfileResponse,
  updateCurrentUserProfile,
} from '@/services/authService';

const logo = require('@/assets/Logo/BantayMarikinaLogo.png');
const defaultProfile = require('@/assets/statics/pfp.png');
const cameraIcon = require('@/assets/Icons/Camera.png');
const penIcon = require('@/assets/Icons/Pen.png');
const iconSources = {
  alert: require('@/assets/Icons/Alert.png'),
  home: require('@/assets/Icons/Home.png'),
  map: require('@/assets/Icons/Map.png'),
  notification: require('@/assets/Icons/Notification.png'),
  profileActive: require('@/assets/Icons/Profile (2).png'),
};

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
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor="#8a8a8a"
        style={[styles.input, editable ? styles.inputEditable : styles.inputLocked]}
        value={value}
      />
    </View>
  );
}

function NavIcon({ name }: { name: 'home' | 'map' | 'report' | 'bell' | 'user' }) {
  const sourceByName = {
    bell: iconSources.notification,
    home: iconSources.home,
    map: iconSources.map,
    report: iconSources.alert,
    user: iconSources.profileActive,
  };

  return <Image source={sourceByName[name]} style={styles.navIcon} resizeMode="contain" />;
}

export default function ProfileScreen() {
  const { session, updateSessionProfile } = useAuthSession();
  const idToken = session?.idToken ?? '';
  const fallbackName = session?.full_name ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState('');
  const [form, setForm] = useState<ProfileForm>(() => toForm());
  const [error, setError] = useState('');

  const fullName = useMemo(() => buildFullName(form, fallbackName), [fallbackName, form]);
  const profileSource: ImageSourcePropType = photoUri ? { uri: photoUri } : defaultProfile;

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
      setPhotoUri(result.assets[0].uri);
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />

        <View style={styles.profileHeader}>
          <View style={styles.photoWrap}>
            <Image source={profileSource} style={styles.profilePhoto} resizeMode="cover" />
            <Pressable style={styles.photoButton} onPress={pickProfilePhoto}>
              <Image source={cameraIcon} style={styles.photoButtonIcon} resizeMode="contain" />
            </Pressable>
          </View>
          <Text style={styles.fullName}>{fullName}</Text>
        </View>

        <Pressable style={styles.editButton} onPress={saveProfile} disabled={isSaving || isLoading}>
          <Image source={penIcon} style={styles.editIcon} resizeMode="contain" />
          <Text style={styles.editText}>{isEditing ? 'Save' : 'Edit'}</Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color={Colors.light.primary} style={styles.loader} />
        ) : (
          <>
            {error ? (
              <Pressable style={styles.errorBox} onPress={loadProfile}>
                <Text style={styles.errorText}>{error} Tap to retry.</Text>
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

            <Pressable style={styles.nextButton} onPress={saveProfile} disabled={isSaving}>
              <Text style={styles.nextText}>{isSaving ? 'Saving...' : isEditing ? 'Save' : 'Next'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => router.push('/home')}>
          <NavIcon name="home" />
          <Text style={styles.navLabel}>Home</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <NavIcon name="map" />
          <Text style={styles.navLabel}>Map</Text>
        </Pressable>
        <Pressable style={[styles.navItem, styles.reportNav]}>
          <View style={styles.reportButton}>
            <NavIcon name="report" />
          </View>
          <Text style={styles.navLabel}>Report</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <NavIcon name="bell" />
          <Text style={styles.navLabel}>Notification</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <View style={styles.activeIconBubble}>
            <NavIcon name="user" />
          </View>
          <Text style={styles.activeNavLabel}>Profile</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
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
    backgroundColor: '#f2f2f2',
    borderRadius: 49,
    height: 98,
    width: 98,
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    borderColor: '#fff',
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
    color: '#000',
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
    tintColor: '#215582',
    width: 16,
  },
  editText: {
    color: '#215582',
    fontSize: 15,
    fontWeight: '600',
  },
  loader: {
    marginTop: 36,
  },
  errorBox: {
    backgroundColor: '#fff3f3',
    borderColor: '#f1b2b2',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 10,
  },
  errorText: {
    color: '#9f3434',
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
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  required: {
    color: '#f03a3a',
  },
  input: {
    borderColor: '#ededed',
    borderRadius: 14,
    borderWidth: 1,
    color: '#111',
    fontSize: 18,
    height: 80,
    paddingHorizontal: 20,
  },
  inputLocked: {
    backgroundColor: '#fafafa',
  },
  inputEditable: {
    backgroundColor: '#fff',
    borderColor: Colors.light.primary,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
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
  bottomNav: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 117, 180, 0.92)',
    borderRadius: 50,
    bottom: 24,
    elevation: 6,
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-around',
    left: 16,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  reportNav: {
    marginTop: -26,
  },
  activeIconBubble: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 31,
    justifyContent: 'center',
    width: 38,
  },
  reportButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    elevation: 5,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    width: 56,
  },
  navLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  activeNavLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  navIcon: {
    height: 24,
    width: 24,
  },
});
