import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { LoginResponse, UserProfileResponse } from '@/services/authService';

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

    AsyncStorage.getItem(`bantay.profile.photo.${session.uid}`)
      .then((uri) => setProfilePhotoUriState(uri ?? ''))
      .catch(() => setProfilePhotoUriState(''));
  }, [session?.uid]);

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
