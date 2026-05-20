import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { RegisterPayload } from '@/services/authService';

type SignupDraft = RegisterPayload;

type SignupContextValue = {
  draft: SignupDraft;
  resetDraft: () => void;
  updateDraft: (updates: Partial<SignupDraft>) => void;
};

const emptyDraft: SignupDraft = {
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  gender: '',
  contact_number: '',
  email: '',
  barangay: '',
  street_block: '',
  house_number: '',
  username: '',
  password: '',
  confirm_password: '',
};

const SignupContext = createContext<SignupContextValue | undefined>(undefined);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(emptyDraft);

  const value = useMemo(
    () => ({
      draft,
      resetDraft: () => setDraft(emptyDraft),
      updateDraft: (updates: Partial<SignupDraft>) =>
        setDraft((current) => ({
          ...current,
          ...updates,
        })),
    }),
    [draft]
  );

  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignupDraft() {
  const context = useContext(SignupContext);

  if (!context) {
    throw new Error('useSignupDraft must be used inside SignupProvider');
  }

  return context;
}
