import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { LoginResponse, UserProfileResponse } from '@/services/authService';
import { ensureFirebaseSession } from '@/services/firebaseSession';
import { getUserProfilePhotoUrl, subscribeToUserProfilePhoto } from '@/services/profilePhotoService';

type AuthSessionContextValue = {
  session: LoginResponse | null;
  profilePhotoUri: string;
  setSession: (session: LoginResponse | null) => void;
  setProfilePhotoUri: (uri: string) => void;
  updateSessionProfile: (profile: UserProfileResponse) => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [profilePhotoUri, setProfilePhotoUriState] = useState('');

  useEffect(() => {
    if (!session?.uid) {
      setProfilePhotoUriState('');
      return;
    }

    let isActive = true;

    AsyncStorage.getItem(`bantay.profile.photo.${session.uid}`)
      .then((uri) => {
        if (isActive) {
          setProfilePhotoUriState(uri ?? session.profile?.profilePhotoUrl ?? session.profile?.profile_photo_url ?? session.profile?.photoURL ?? '');
        }
      })
      .catch(() => {
        if (isActive) {
          setProfilePhotoUriState('');
        }
      });

    ensureFirebaseSession(session.idToken)
      .then(() => getUserProfilePhotoUrl(session.uid))
      .then((uri) => {
        if (!isActive || !uri) return;

        setProfilePhotoUriState(uri);
        AsyncStorage.setItem(`bantay.profile.photo.${session.uid}`, uri).catch(() => undefined);
      })
      .catch(() => undefined);

    let unsubscribeProfile: (() => void) | undefined;
    ensureFirebaseSession(session.idToken)
      .then(() => {
        if (!isActive) return;
        unsubscribeProfile = subscribeToUserProfilePhoto(session.uid, (uri) => {
          if (!isActive) return;
          setProfilePhotoUriState(uri);
          if (uri) {
            AsyncStorage.setItem(`bantay.profile.photo.${session.uid}`, uri).catch(() => undefined);
          } else {
            AsyncStorage.removeItem(`bantay.profile.photo.${session.uid}`).catch(() => undefined);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      unsubscribeProfile?.();
    };
  }, [session?.idToken, session?.profile?.photoURL, session?.profile?.profilePhotoUrl, session?.profile?.profile_photo_url, session?.uid]);

  const setProfilePhotoUri = useCallback((uri: string) => {
    setProfilePhotoUriState(uri);

    if (session?.uid) {
      AsyncStorage.setItem(`bantay.profile.photo.${session.uid}`, uri).catch(() => undefined);
    }
  }, [session?.uid]);

  const value = useMemo(
    () => ({
      profilePhotoUri,
      session,
      setSession,
      setProfilePhotoUri,
      updateSessionProfile: (profile: UserProfileResponse) => {
        setSession((current) => {
          if (!current) return current;

          return {
            ...current,
            barangay: profile.profile.address?.barangay ?? profile.profile.barangay,
            full_name: profile.full_name,
            profile: profile.profile,
            role: profile.role,
            username: profile.username,
          };
        });
      },
    }),
    [profilePhotoUri, session, setProfilePhotoUri]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  }

  return context;
}
