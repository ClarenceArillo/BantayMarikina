import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getExpoHost() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri?.split(':')[0];
}

function getLocalBaseUrl() {
  if (Platform.OS === 'android' && !getExpoHost()) {
    return 'http://10.0.2.2:3000/api';
  }

  const host = getExpoHost() || 'localhost';
  return `http://${host}:3000/api`;
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = configuredApiUrl || getLocalBaseUrl();

export type RegisterPayload = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  gender?: string;
  contact_number?: string;
  email: string;
  barangay?: string;
  street_block?: string;
  house_number?: string;
  username: string;
  password: string;
  confirm_password: string;
};

export type LoginResponse = {
  message: string;
  uid: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  username: string;
  role: string;
  barangay?: string;
  full_name: string;
  profile?: {
    name?: {
      first?: string;
      middle?: string;
      last?: string;
      suffix?: string;
      full?: string;
    };
    address?: {
      barangay?: string;
      street_block?: string;
      house_number?: string;
    };
    barangay?: string;
    contact_number?: string;
    email?: string;
    gender?: string;
    photoURL?: string;
    profilePhotoUrl?: string;
    profile_photo_url?: string;
  };
};

export type RegisterResponse = {
  message: string;
  uid: string;
  username: string;
  email: string;
};

export type UserProfileResponse = {
  uid: string;
  username: string;
  role: string;
  full_name: string;
  profile: {
    name?: {
      first?: string;
      middle?: string;
      last?: string;
      suffix?: string;
      full?: string;
    };
    address?: {
      barangay?: string;
      street_block?: string;
      house_number?: string;
    };
    barangay?: string;
    contact_number?: string;
    email?: string;
    gender?: string;
    photoURL?: string;
    profilePhotoUrl?: string;
    profile_photo_url?: string;
  };
};

export type FirebaseCustomTokenResponse = {
  customToken: string;
};

export type UpdateProfilePayload = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  gender?: string;
  contact_number?: string;
  email: string;
  barangay?: string;
  street_block?: string;
  house_number?: string;
};

async function request<T>(path: string, options: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  } catch {
    throw new Error(`Cannot reach backend at ${API_BASE_URL}. Check that the backend server is running and your phone is on the same network.`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}

function requestWithAuth<T>(path: string, idToken: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...options.headers,
    },
  });
}

export function loginUser(identifier: string, password: string) {
  return request<LoginResponse>('/users/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export function registerUser(payload: RegisterPayload) {
  return request<RegisterResponse>('/users/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendPasswordReset(email: string) {
  return request<{ message: string }>('/users/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function getFirebaseCustomToken(idToken: string) {
  return requestWithAuth<FirebaseCustomTokenResponse>('/users/firebase-token', idToken, {
    method: 'POST',
  });
}

export function getCurrentUserProfile(idToken: string) {
  return requestWithAuth<UserProfileResponse>('/users/me', idToken);
}

export function updateCurrentUserProfile(idToken: string, payload: UpdateProfilePayload) {
  return requestWithAuth<UserProfileResponse>('/users/me', idToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
