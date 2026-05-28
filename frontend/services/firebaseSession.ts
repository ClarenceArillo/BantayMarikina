import { signInWithCustomToken } from 'firebase/auth';

import { getFirebaseClients } from '@/config/firebase';
import { getFirebaseCustomToken } from '@/services/authService';

let sessionPromise: Promise<string> | null = null;
let activeBackendToken: string | null = null;

export async function ensureFirebaseSession(idToken?: string | null) {
  if (!idToken) {
    throw new Error('Please sign in before using live hazard reporting.');
  }

  const { auth } = getFirebaseClients();

  if (auth.currentUser && activeBackendToken === idToken) {
    return Promise.resolve(auth.currentUser.uid);
  }

  if (!sessionPromise || activeBackendToken !== idToken) {
    activeBackendToken = idToken;
    sessionPromise = getFirebaseCustomToken(idToken).then(({ customToken }) =>
      signInWithCustomToken(auth, customToken).then((credential) => credential.user.uid)
    ).catch((error) => {
      if (activeBackendToken === idToken) {
        activeBackendToken = null;
        sessionPromise = null;
      }

      throw error;
    });
  }

  return sessionPromise;
}

export function clearFirebaseSessionState() {
  activeBackendToken = null;
  sessionPromise = null;
}
