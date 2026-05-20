import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

const requiredFirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
} satisfies Pick<FirebaseOptions, 'apiKey' | 'authDomain' | 'projectId' | 'storageBucket'>;

const optionalFirebaseConfig = {
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} satisfies Pick<FirebaseOptions, 'messagingSenderId' | 'appId'>;

function cleanConfigValue(value?: string) {
  const cleanValue = String(value || '').trim();
  return cleanValue || undefined;
}

function getMissingRequiredConfig() {
  return Object.entries(requiredFirebaseConfig)
    .filter(([, value]) => !cleanConfigValue(value))
    .map(([key]) => `EXPO_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
}

function hasFirebaseConfig() {
  return getMissingRequiredConfig().length === 0;
}

function buildFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: cleanConfigValue(requiredFirebaseConfig.apiKey),
    authDomain: cleanConfigValue(requiredFirebaseConfig.authDomain),
    projectId: cleanConfigValue(requiredFirebaseConfig.projectId),
    storageBucket: cleanConfigValue(requiredFirebaseConfig.storageBucket),
    messagingSenderId: cleanConfigValue(optionalFirebaseConfig.messagingSenderId),
    appId: cleanConfigValue(optionalFirebaseConfig.appId),
  };
}

let clients: FirebaseClients | null = null;

export function getFirebaseClients() {
  if (!hasFirebaseConfig()) {
    const missingKeys = getMissingRequiredConfig().join(', ');
    throw new Error(`Firebase client config is missing: ${missingKeys}. Add these values to frontend/.env and restart Expo.`);
  }

  if (!clients) {
    const app = getApps().length ? getApp() : initializeApp(buildFirebaseConfig());

    clients = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };
  }

  return clients;
}
