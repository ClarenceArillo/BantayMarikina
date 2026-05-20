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
import { useAppTheme } from '@/components/EmergencyUI';
import { HazardDetailsSheet } from '@/components/HazardDetailsSheet';
import { HazardMapView } from '@/components/HazardMapView';
import { ReportCard } from '@/components/ReportCard';
import { ReportFilterBar } from '@/components/ReportFilterBar';
import { useAuthSession } from '@/context/auth-context';
import { useHazardReports } from '@/hooks/useHazardReports';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { ensureFirebaseSession } from '@/services/firebaseSession';
import { submitHazardReport } from '@/services/hazardReportService';
import { HAZARD_TYPES, SEVERITY_LEVELS, type HazardReport, type HazardSeverity, type HazardType, type ReportFilters } from '@/types/hazard';

const iconSources = {
  arrow: require('@/assets/Icons/Arrow.png'),
  camera: require('@/assets/Icons/Camera.png'),
  pin: require('@/assets/Icons/Pin.png'),
};

export default function ReportScreen() {
  const theme = useAppTheme();
  const { session } = useAuthSession();
  const { location, isLocating, error: locationError, locateOnce } = useLiveLocation(true);
  const [hazardType, setHazardType] = useState<HazardType>('Flood');
  const [severity, setSeverity] = useState<HazardSeverity>('Moderate');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({ dateRange: 'month', hazardType: 'All', severity: 'All', status: 'All', source: 'All' });
  const { reports, isLoading: isFeedLoading } = useHazardReports(session?.idToken, 80, filters);

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={[styles.backButton, { backgroundColor: theme.primaryTint }]} onPress={() => router.back()}>
            <Image source={iconSources.arrow} style={[styles.backIcon, { tintColor: theme.primary }]} resizeMode="contain" />
          </Pressable>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Report Hazard</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>GPS location is attached automatically</Text>
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

        <View style={[styles.locationPanel, { backgroundColor: theme.primaryTint, borderColor: theme.borderSoft }]}>
          <View>
            <Text style={[styles.panelLabel, { color: theme.primaryDark }]}>Current Location</Text>
            <Text style={[styles.locationText, { color: theme.text }]}>
              {userLocation
                ? `${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}`
                : 'Waiting for GPS signal'}
            </Text>
            <Text style={[styles.accuracyText, { color: theme.muted }]}>
              {userLocation?.accuracy ? `Accuracy: about ${Math.round(userLocation.accuracy)}m` : barangay || 'Marikina City'}
            </Text>
          </View>
          <Pressable style={[styles.locateButton, { backgroundColor: theme.primary }]} onPress={() => locateOnce().catch(() => undefined)}>
            <Text style={styles.locateText}>Locate</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Hazard Type</Text>
          <View style={styles.chipGrid}>
            {HAZARD_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, hazardType === type ? { backgroundColor: theme.primaryTint, borderColor: theme.primary } : null]}
                onPress={() => setHazardType(type)}>
                <Text style={[styles.chipText, { color: hazardType === type ? theme.primaryDark : theme.muted }]}>{type}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Severity</Text>
          <View style={[styles.segmentRow, { backgroundColor: theme.surfaceMuted }]}>
            {SEVERITY_LEVELS.map((level) => (
              <Pressable
                key={level}
                style={[styles.segment, severity === level ? { backgroundColor: theme.surface, shadowColor: theme.black } : null]}
                onPress={() => setSeverity(level)}>
                <Text style={[styles.segmentText, { color: severity === level ? theme.primary : theme.muted }]}>{level}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Example: Waist-level flood near the bridge"
            placeholderTextColor={theme.placeholder}
            multiline
            maxLength={240}
            style={[styles.descriptionInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
          />
          <Text style={[styles.counter, { color: theme.muted }]}>{description.length}/240</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Optional Image</Text>
          <Pressable style={[styles.imagePicker, { backgroundColor: theme.input, borderColor: theme.border }]} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <>
                <Image source={iconSources.camera} style={[styles.cameraIcon, { tintColor: theme.primary }]} resizeMode="contain" />
                <Text style={[styles.imagePickerText, { color: theme.primary }]}>Attach photo</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable
          style={[styles.submitButton, { backgroundColor: theme.primary }, isSubmitting ? styles.submitDisabled : null]}
          disabled={isSubmitting}
          onPress={handleSubmit}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Live Report</Text>}
        </Pressable>

        <View style={styles.feedSection}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Community Reports</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>{reports.length} live reports matching filters</Text>
          </View>
          <ReportFilterBar filters={filters} onChange={setFilters} />
          {isFeedLoading ? <ActivityIndicator color={theme.primary} /> : null}
          {reports.slice(0, 12).map((item) => (
            <ReportCard key={item.id} report={item} onPress={setSelectedReport} />
          ))}
        </View>
      </ScrollView>
      <BottomNav activeTab="report" />
      <HazardDetailsSheet report={selectedReport} onClose={() => setSelectedReport(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    width: 38,
  },
  backIcon: {
    height: 18,
    width: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  locationPanel: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  locationText: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  accuracyText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  locateButton: {
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
    fontSize: 13,
    fontWeight: '900',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  segmentRow: {
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
  segmentText: {
    fontSize: 11,
    fontWeight: '900',
  },
  descriptionInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 112,
    padding: 14,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 10,
    fontWeight: '700',
  },
  imagePicker: {
    alignItems: 'center',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 142,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraIcon: {
    height: 30,
    width: 30,
  },
  imagePickerText: {
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
  feedSection: {
    gap: 12,
    marginTop: 8,
  },
});
