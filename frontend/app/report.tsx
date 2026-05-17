import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomNav } from '@/components/BottomNav';
import { HazardMapView } from '@/components/HazardMapView';
import { Colors } from '@/constants/theme';
import { useAuthSession } from '@/context/auth-context';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { ensureFirebaseSession } from '@/services/firebaseSession';
import { submitHazardReport } from '@/services/hazardReportService';
import { HAZARD_TYPES, SEVERITY_LEVELS, type HazardSeverity, type HazardType } from '@/types/hazard';

const iconSources = {
  arrow: require('@/assets/Icons/Arrow.png'),
  camera: require('@/assets/Icons/Camera.png'),
  pin: require('@/assets/Icons/Pin.png'),
};

export default function ReportScreen() {
  const { session } = useAuthSession();
  const { location, isLocating, error: locationError, locateOnce } = useLiveLocation(true);
  const [hazardType, setHazardType] = useState<HazardType>('Flood');
  const [severity, setSeverity] = useState<HazardSeverity>('Moderate');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const barangay = session?.profile?.address?.barangay || session?.barangay || '';
  const userLocation = useMemo(
    () =>
      location
        ? {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
          }
        : null,
    [location]
  );

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    try {
      setIsSubmitting(true);
      const currentLocation = location || (await locateOnce());

      await ensureFirebaseSession(session?.idToken);
      await submitHazardReport({
        hazardType,
        severity,
        description,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracyMeters: currentLocation.coords.accuracy,
        barangay,
        userId: session?.uid,
        reporterName: session?.full_name,
        imageUri: imageUri || undefined,
      });

      Alert.alert('Report submitted', 'Your hazard report is now visible on the live map.');
      router.replace('/map' as never);
    } catch (submitError) {
      Alert.alert('Unable to submit report', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Image source={iconSources.arrow} style={styles.backIcon} resizeMode="contain" />
          </Pressable>
          <View>
            <Text style={styles.title}>Report Hazard</Text>
            <Text style={styles.subtitle}>GPS location is attached automatically</Text>
          </View>
        </View>

        <HazardMapView
          reports={[]}
          pinSource={iconSources.pin}
          userLocation={userLocation}
          height={236}
          initialZoom={16}
          isLoading={isLocating && !location}
          error={locationError}
          compact
        />

        <View style={styles.locationPanel}>
          <View>
            <Text style={styles.panelLabel}>Current Location</Text>
            <Text style={styles.locationText}>
              {userLocation
                ? `${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
                : 'Waiting for GPS signal'}
            </Text>
            <Text style={styles.accuracyText}>
              {userLocation?.accuracy ? `Accuracy: about ${Math.round(userLocation.accuracy)}m` : barangay || 'Marikina City'}
            </Text>
          </View>
          <Pressable style={styles.locateButton} onPress={() => locateOnce().catch(() => undefined)}>
            <Text style={styles.locateText}>Locate</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Hazard Type</Text>
          <View style={styles.chipGrid}>
            {HAZARD_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, hazardType === type ? styles.chipActive : null]}
                onPress={() => setHazardType(type)}>
                <Text style={[styles.chipText, hazardType === type ? styles.chipTextActive : null]}>{type}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Severity</Text>
          <View style={styles.segmentRow}>
            {SEVERITY_LEVELS.map((level) => (
              <Pressable
                key={level}
                style={[styles.segment, severity === level ? styles.segmentActive : null]}
                onPress={() => setSeverity(level)}>
                <Text style={[styles.segmentText, severity === level ? styles.segmentTextActive : null]}>{level}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Example: Waist-level flood near the bridge"
            placeholderTextColor={Colors.light.placeholder}
            multiline
            maxLength={240}
            style={styles.descriptionInput}
          />
          <Text style={styles.counter}>{description.length}/240</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Optional Image</Text>
          <Pressable style={styles.imagePicker} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <>
                <Image source={iconSources.camera} style={styles.cameraIcon} resizeMode="contain" />
                <Text style={styles.imagePickerText}>Attach photo</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable
          style={[styles.submitButton, isSubmitting ? styles.submitDisabled : null]}
          disabled={isSubmitting}
          onPress={handleSubmit}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Live Report</Text>}
        </Pressable>
      </ScrollView>
      <BottomNav activeTab="report" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 22,
    paddingBottom: 124,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#edf4fa',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    width: 38,
  },
  backIcon: {
    height: 18,
    tintColor: Colors.light.primary,
    width: 18,
  },
  title: {
    color: Colors.light.text,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.light.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  locationPanel: {
    alignItems: 'center',
    backgroundColor: '#eef6fb',
    borderColor: '#c9deef',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  panelLabel: {
    color: Colors.light.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  locationText: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  accuracyText: {
    color: Colors.light.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  locateButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  locateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  section: {
    gap: 10,
  },
  label: {
    color: Colors.light.text,
    fontSize: 13,
    fontWeight: '900',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    backgroundColor: '#f4f7fa',
    borderColor: '#dce5ed',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: '#e7f1fa',
    borderColor: Colors.light.primary,
  },
  chipText: {
    color: Colors.light.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextActive: {
    color: Colors.light.primaryDark,
  },
  segmentRow: {
    backgroundColor: '#f0f4f7',
    borderRadius: 15,
    flexDirection: 'row',
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: '#fff',
    elevation: 2,
  },
  segmentText: {
    color: Colors.light.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: Colors.light.primary,
  },
  descriptionInput: {
    backgroundColor: '#f8fafb',
    borderColor: '#dce5ed',
    borderRadius: 14,
    borderWidth: 1,
    color: Colors.light.text,
    fontSize: 14,
    minHeight: 112,
    padding: 14,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: Colors.light.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  imagePicker: {
    alignItems: 'center',
    backgroundColor: '#f8fafb',
    borderColor: '#d6e0e8',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 142,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraIcon: {
    height: 30,
    tintColor: Colors.light.primary,
    width: 30,
  },
  imagePickerText: {
    color: Colors.light.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.68,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
