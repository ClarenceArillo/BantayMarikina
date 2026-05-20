import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { getFirebaseClients } from '@/config/firebase';

const USERS_COLLECTION = 'Users';

function getImageExtension(imageUri: string, contentType?: string) {
  const uriExtension = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase();

  if (uriExtension && /^[a-z0-9]+$/.test(uriExtension) && uriExtension.length <= 5) {
    return uriExtension === 'jpeg' ? 'jpg' : uriExtension;
  }

  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  return 'jpg';
}

export async function getUserProfilePhotoUrl(userId: string) {
  const { db } = getFirebaseClients();
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  const data = snapshot.data();

  return String(data?.profilePhotoUrl || data?.profile_photo_url || data?.photoURL || '');
}

export async function uploadUserProfilePhoto(userId: string, imageUri: string) {
  const { db, storage } = getFirebaseClients();
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const extension = getImageExtension(imageUri, blob.type);
  const photoRef = ref(storage, `profile-photos/${userId}/${Date.now()}.${extension}`);

  await uploadBytes(photoRef, blob, {
    contentType: blob.type || 'image/jpeg',
  });

  const photoUrl = await getDownloadURL(photoRef);

  await updateDoc(doc(db, USERS_COLLECTION, userId), {
    photoURL: photoUrl,
    profilePhotoUrl: photoUrl,
    profile_photo_url: photoUrl,
    updated_at: serverTimestamp(),
  });

  return photoUrl;
}
