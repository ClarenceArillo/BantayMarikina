import {
  Timestamp,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { getFirebaseClients } from '@/config/firebase';
import type { HazardReport, HazardReportInput } from '@/types/hazard';

const REPORTS_COLLECTION = 'Reports';
const MARIKINA_BOUNDS = {
  minLat: 14.57,
  maxLat: 14.72,
  minLng: 121.03,
  maxLng: 121.18,
};

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function getCoordinate(data: DocumentData, key: 'latitude' | 'longitude') {
  if (typeof data[key] === 'number') return data[key];
  if (key === 'latitude' && typeof data.location?.latitude === 'number') return data.location.latitude;
  if (key === 'longitude' && typeof data.location?.longitude === 'number') return data.location.longitude;
  return null;
}

function normalizeReport(doc: QueryDocumentSnapshot<DocumentData>): HazardReport | null {
  const data = doc.data();
  const latitude = getCoordinate(data, 'latitude');
  const longitude = getCoordinate(data, 'longitude');

  if (latitude === null || longitude === null) return null;

  return {
    id: doc.id,
    hazardType: data.hazardType || data.hazard_type || 'Others',
    description: data.description || '',
    latitude,
    longitude,
    timestamp: toDate(data.timestamp || data.createdAt),
    userId: data.userId || data.sender_id,
    reporterName: data.reporterName,
    severity: data.severity,
    barangay: data.barangay,
    imageUrl: data.imageUrl || data.image_url,
    status: data.status || 'active',
    accuracyMeters: data.accuracyMeters ?? null,
  };
}

export function isInsideMarikina(latitude: number, longitude: number) {
  return (
    latitude >= MARIKINA_BOUNDS.minLat &&
    latitude <= MARIKINA_BOUNDS.maxLat &&
    longitude >= MARIKINA_BOUNDS.minLng &&
    longitude <= MARIKINA_BOUNDS.maxLng
  );
}

export function validateHazardReport(input: HazardReportInput) {
  const description = input.description.trim();

  if (!description || description.length < 8) {
    throw new Error('Please add a short description with at least 8 characters.');
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('GPS location is not available yet.');
  }

  if (!isInsideMarikina(input.latitude, input.longitude)) {
    throw new Error('Reports are currently limited to Marikina City.');
  }
}

async function uploadReportImage(imageUri: string, userId?: string) {
  const { storage } = getFirebaseClients();
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const extension = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
  const imageRef = ref(storage, `hazard-reports/${userId || 'anonymous'}/${Date.now()}.${extension}`);

  await uploadBytes(imageRef, blob, {
    contentType: blob.type || 'image/jpeg',
  });

  return getDownloadURL(imageRef);
}

export async function submitHazardReport(input: HazardReportInput) {
  validateHazardReport(input);

  const { db } = getFirebaseClients();
  const imageUrl = input.imageUri ? await uploadReportImage(input.imageUri, input.userId) : null;

  return addDoc(collection(db, REPORTS_COLLECTION), {
    hazardType: input.hazardType,
    hazard_type: input.hazardType,
    description: input.description.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters ?? null,
    severity: input.severity,
    barangay: input.barangay || '',
    userId: input.userId || null,
    sender_id: input.userId || null,
    reporterName: input.reporterName || '',
    imageUrl,
    image_url: imageUrl,
    status: 'active',
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToHazardReports(
  onReports: (reports: HazardReport[]) => void,
  onError: (error: FirestoreError) => void,
  maxReports = 300
): Unsubscribe {
  const { db } = getFirebaseClients();
  const reportsQuery = query(
    collection(db, REPORTS_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(maxReports)
  );

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      const reports = snapshot.docs
        .map(normalizeReport)
        .filter((report): report is HazardReport => Boolean(report))
        .filter((report) => report.status !== 'resolved' && report.status !== 'rejected');

      onReports(reports);
    },
    onError
  );
}
