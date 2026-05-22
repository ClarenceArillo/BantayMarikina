import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { getFirebaseClients } from '@/config/firebase';
import { API_BASE_URL } from '@/services/authService';
import { deleteCloudinaryMedia, uploadToCloudinary } from '@/services/cloudinaryService';

const USERS_COLLECTION = 'Users';

export async function getUserProfilePhotoUrl(userId: string) {
  const { db } = getFirebaseClients();
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  const data = snapshot.data();

  return String(data?.profilePhotoUrl || data?.profile_photo_url || data?.photoURL || '');
}

async function mediaRequest<T>(path: string, idToken: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export function subscribeToUserProfilePhoto(userId: string, onChange: (uri: string) => void): Unsubscribe {
  const { db } = getFirebaseClients();
  return onSnapshot(doc(db, USERS_COLLECTION, userId), (snapshot) => {
    const data = snapshot.data();
    onChange(String(data?.profilePhotoUrl || data?.profile_photo_url || data?.photoURL || ''));
  });
}

export async function uploadUserProfilePhoto(
  userId: string,
  idToken: string,
  imageUri: string,
  onProgress?: (progress: number) => void
) {
  const media = await uploadToCloudinary({
    folder: 'profiles',
    idToken,
    mediaUri: imageUri,
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
