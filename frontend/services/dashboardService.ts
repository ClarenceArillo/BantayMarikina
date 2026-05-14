import { API_BASE_URL } from '@/services/authService';

export type WeatherForecast = {
  day: string;
  temp_max: number;
  temp_min: number;
  condition: string;
};

export type WeatherData = {
  location: string;
  date: string;
  temperature: number;
  humidity: number;
  windspeed: number;
  condition: string;
  forecast: WeatherForecast[];
  updated_at: string;
};

export type RiverStation = {
  station: string;
  level: number | null;
  status: 'Normal' | 'Warning' | 'Critical' | 'Unavailable' | string;
  last_reading: string | null;
};

export type WaterLevelData = {
  stations: RiverStation[];
  updated_at: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
}

export function getWeather() {
  return getJson<WeatherData>('/weather');
}

export function getWaterLevels() {
  return getJson<WaterLevelData>('/waterlevel');
}
