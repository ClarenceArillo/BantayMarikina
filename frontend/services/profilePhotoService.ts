import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { getFirebaseClients } from '@/config/firebase';
import { API_BASE_URL } from '@/services/authService';
import { deleteCloudinaryMedia, uploadToCloudinary } from '@/services/cloudinaryService';
import { subscribeWithRetry } from '@/services/realtime';

const USERS_COLLECTION = 'Users';
const REQUEST_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeProfilePhoto(data: Record<string, unknown> | undefined) {
  return String(data?.profilePhotoUrl || data?.profile_photo_url || data?.photoURL || '');
}

export async function getUserProfilePhotoUrl(userId: string) {
  const { db } = getFirebaseClients();
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  const data = snapshot.data();

  return normalizeProfilePhoto(data);
}

async function mediaRequest<T>(path: string, idToken: string, options: RequestInit = {}) {
  let response: Response | null = null;
  const requestOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetchWithTimeout(`${API_BASE_URL}${path}`, requestOptions);
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) break;
    } catch (error) {
      if (attempt === 2) throw error;
    }

    await sleep(500 * (attempt + 1));
  }

  if (!response) throw new Error('Request failed.');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export function subscribeToUserProfilePhoto(userId: string, onChange: (uri: string) => void): Unsubscribe {
  const { db } = getFirebaseClients();
  let lastUri = '';

  return subscribeWithRetry(
    (handleError) => onSnapshot(doc(db, USERS_COLLECTION, userId), (snapshot) => {
      const nextUri = normalizeProfilePhoto(snapshot.data());
      if (nextUri === lastUri) return;
      lastUri = nextUri;
      onChange(nextUri);
    }, handleError),
    () => undefined
  );
}

export async function uploadUserProfilePhoto(
  userId: string,
  idToken: string,
  imageUri: string,
  imageSizeBytes?: number,
  onProgress?: (progress: number) => void
) {
  const media = await uploadToCloudinary({
    folder: 'profiles',
    idToken,
    mediaUri: imageUri,
    mediaSizeBytes: imageSizeBytes,
    onProgress,
    resourceType: 'image',
  });

  const result = await mediaRequest<{ photoUrl: string; previousPublicId?: string | null }>('/media/cloudinary/profile-photo', idToken, {
    method: 'POST',
    body: JSON.stringify({ media }),
  });

  if (result.previousPublicId && result.previousPublicId !== media.public_id) {
    deleteCloudinaryMedia(idToken, result.previousPublicId, 'image', userId).catch(() => undefined);
  }

  return result.photoUrl;
}

export async function removeUserProfilePhoto(userId: string, idToken: string) {
  const result = await mediaRequest<{ removed: boolean; previousPublicId?: string | null }>('/media/cloudinary/profile-photo', idToken, {
    method: 'DELETE',
  });

  if (result.previousPublicId) {
    deleteCloudinaryMedia(idToken, result.previousPublicId, 'image', userId).catch(() => undefined);
  }

  return result.removed;
}
