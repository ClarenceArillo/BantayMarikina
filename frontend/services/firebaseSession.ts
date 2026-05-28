import { signInWithCustomToken } from 'firebase/auth';

import { getFirebaseClients } from '@/config/firebase';
import { getFirebaseCustomToken } from '@/services/authService';

let sessionPromise: Promise<string> | null = null;
let activeBackendToken: string | null = null;

function tokenFingerprint(token?: string | null) {
  if (!token) return 'none';
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

function logFirebaseSessionTrace(message: string, meta: Record<string, unknown> = {}) {
  console.log('[firebase-session]', message, {
    at: new Date().toISOString(),
    ...meta,
  });
}

export async function ensureFirebaseSession(idToken?: string | null) {
  if (!idToken) {
    throw new Error('Please sign in before using live hazard reporting.');
  }

  const { auth } = getFirebaseClients();

  if (auth.currentUser && activeBackendToken === idToken) {
    try {
      const tokenResult = await auth.currentUser.getIdTokenResult();
      logFirebaseSessionTrace('reusing Firebase Auth session', {
        backendToken: tokenFingerprint(idToken),
        firebaseUid: auth.currentUser.uid,
        firebaseTokenExpirationTime: tokenResult.expirationTime,
        firebaseTokenIssuedAtTime: tokenResult.issuedAtTime,
        providerId: auth.currentUser.providerId,
      });
    } catch (error) {
      logFirebaseSessionTrace('refreshing stale Firebase Auth session', {
        backendToken: tokenFingerprint(idToken),
        firebaseUid: auth.currentUser.uid,
        error: error instanceof Error ? error.message : String(error),
      });
      await auth.currentUser.getIdToken(true);
    }

    return auth.currentUser.uid;
  }

  if (!sessionPromise || activeBackendToken !== idToken) {
    activeBackendToken = idToken;
    logFirebaseSessionTrace('requesting custom Firebase token', {
      backendToken: tokenFingerprint(idToken),
      existingFirebaseUid: auth.currentUser?.uid || null,
    });
    sessionPromise = getFirebaseCustomToken(idToken).then(({ customToken }) =>
      signInWithCustomToken(auth, customToken).then(async (credential) => {
        const tokenResult = await credential.user.getIdTokenResult();
        logFirebaseSessionTrace('signed in with custom Firebase token', {
          backendToken: tokenFingerprint(idToken),
          firebaseUid: credential.user.uid,
          firebaseTokenExpirationTime: tokenResult.expirationTime,
          firebaseTokenIssuedAtTime: tokenResult.issuedAtTime,
        });
        return credential.user.uid;
      })
    ).catch((error) => {
      if (activeBackendToken === idToken) {
        activeBackendToken = null;
        sessionPromise = null;
      }

      logFirebaseSessionTrace('failed to establish Firebase Auth session', {
        backendToken: tokenFingerprint(idToken),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
  }

  return sessionPromise;
}

export function clearFirebaseSessionState() {
  activeBackendToken = null;
  sessionPromise = null;
}
