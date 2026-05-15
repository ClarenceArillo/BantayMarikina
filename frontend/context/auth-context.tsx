import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { LoginResponse, UserProfileResponse } from '@/services/authService';

type AuthSessionContextValue = {
  session: LoginResponse | null;
  setSession: (session: LoginResponse | null) => void;
  updateSessionProfile: (profile: UserProfileResponse) => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null);

  const value = useMemo(
    () => ({
      session,
      setSession,
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
    [session]
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
