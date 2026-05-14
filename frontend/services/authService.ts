import { Platform } from 'react-native';

const localBaseUrl = Platform.select({
  android: 'http://10.0.2.2:3000/api',
  default: 'http://localhost:3000/api',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? localBaseUrl ?? 'http://localhost:3000/api';

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
    contact_number?: string;
    email?: string;
  };
};

export type RegisterResponse = {
  message: string;
  uid: string;
  username: string;
  email: string;
};

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
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
