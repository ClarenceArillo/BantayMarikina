import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { getFirebaseClients } from '@/config/firebase';
import { subscribeWithRetry } from '@/services/realtime';

export type WeatherForecast = {
  day: string;
  temp_max: number;
  temp_min: number;
  condition: string;
};

export type WeatherData = {
  location: string;
  date: string;
  temperature: number | null;
  humidity: number | null;
  windspeed: number | null;
  condition: string;
  forecast: WeatherForecast[];
  updated_at: string;
  last_checked_at?: string;
  source?: string;
  source_observed_at?: string | null;
  source_status?: 'ok' | 'error' | 'no_readings' | string;
  source_message?: string | null;
};

export type RiverStation = {
  station: string;
  level: number | null;
  status: 'Normal' | 'Warning' | 'Critical' | 'Unavailable' | string;
  last_reading: string | null;
  source_station?: string;
  trend?: string | null;
  alarms?: Array<{
    name: string;
    level: string;
    threshold: number;
  }>;
  values?: Record<string, number | null> | null;
};

export type WaterLevelData = {
  stations: RiverStation[];
  updated_at: string;
  last_checked_at?: string;
  source?: string;
  source_observed_at?: string | null;
  source_status?: 'ok' | 'error' | 'no_readings' | string;
  source_message?: string | null;
};

export type DashboardData = {
  weather: WeatherData | null;
  waterLevel: WaterLevelData | null;
};

type DashboardListener = (data: DashboardData) => void;
type DashboardErrorListener = (error: Error) => void;

let cachedData: DashboardData = {
  weather: null,
  waterLevel: null,
};
let cachedHash = JSON.stringify(cachedData);
let unsubscribeWeather: Unsubscribe | null = null;
let unsubscribeWaterLevel: Unsubscribe | null = null;
const listeners = new Set<DashboardListener>();
const errorListeners = new Set<DashboardErrorListener>();

function getDashboardDoc(id: 'weather' | 'waterlevel') {
  const { db } = getFirebaseClients();
  return doc(db, 'DashboardData', id);
}

function getDashboardRecordsCollection(id: 'weather' | 'waterlevel') {
  const { db } = getFirebaseClients();
  return collection(db, 'DashboardData', id, 'records');
}

function cleanFirestoreData<T>(data: unknown): T | null {
  if (!data || typeof data !== 'object') return null;
  const { cached_at, source_hash, ...publicData } = data as Record<string, unknown>;
  return publicData as T;
}

function publish(nextData: DashboardData) {
  const nextHash = JSON.stringify(nextData);
  if (nextHash === cachedHash) return;

  cachedData = nextData;
  cachedHash = nextHash;
  listeners.forEach((listener) => listener(cachedData));
}

function notifyError(error: unknown) {
  const normalizedError = error instanceof Error ? error : new Error('Unable to load dashboard data.');
  errorListeners.forEach((listener) => listener(normalizedError));
}

function startFirestoreListeners() {
  if (unsubscribeWeather && unsubscribeWaterLevel) return;

  unsubscribeWeather = subscribeWithRetry(
    (handleError) => onSnapshot(
      getDashboardDoc('weather'),
      (snapshot) => {
        publish({
          ...cachedData,
          weather: snapshot.exists() ? cleanFirestoreData<WeatherData>(snapshot.data()) : null,
        });
      },
      handleError
    ),
    notifyError
  );

  unsubscribeWaterLevel = subscribeWithRetry(
    (handleError) => onSnapshot(
      getDashboardDoc('waterlevel'),
      (snapshot) => {
        publish({
          ...cachedData,
          waterLevel: snapshot.exists() ? cleanFirestoreData<WaterLevelData>(snapshot.data()) : null,
        });
      },
      handleError
    ),
    notifyError
  );
}

function stopFirestoreListeners() {
  if (listeners.size > 0) return;

  unsubscribeWeather?.();
  unsubscribeWaterLevel?.();
  unsubscribeWeather = null;
  unsubscribeWaterLevel = null;
}

export function getDashboardSnapshot() {
  return cachedData;
}

export function subscribeDashboardData(
  listener: DashboardListener,
  onError?: DashboardErrorListener
) {
  listeners.add(listener);
  if (onError) errorListeners.add(onError);
  listener(cachedData);
  startFirestoreListeners();

  return () => {
    listeners.delete(listener);
    if (onError) errorListeners.delete(onError);
    stopFirestoreListeners();
  };
}

export async function refreshDashboardData() {
  const [weatherSnapshot, waterLevelSnapshot] = await Promise.all([
    getDoc(getDashboardDoc('weather')),
    getDoc(getDashboardDoc('waterlevel')),
  ]);

  const nextData = {
    weather: weatherSnapshot.exists()
      ? cleanFirestoreData<WeatherData>(weatherSnapshot.data())
      : null,
    waterLevel: waterLevelSnapshot.exists()
      ? cleanFirestoreData<WaterLevelData>(waterLevelSnapshot.data())
      : null,
  };

  publish(nextData);
  return nextData;
}

export async function getDashboardRecords<T extends WeatherData | WaterLevelData>(
  id: 'weather' | 'waterlevel',
  options: { endAt?: string; max?: number; startAt?: string } = {}
) {
  const constraints: QueryConstraint[] = [];

  if (options.startAt) {
    constraints.push(where('checked_at', '>=', options.startAt));
  }

  if (options.endAt) {
    constraints.push(where('checked_at', '<=', options.endAt));
  }

  constraints.push(orderBy('checked_at', 'desc'));
  constraints.push(limit(options.max ?? 24));

  const snapshot = await getDocs(query(getDashboardRecordsCollection(id), ...constraints));
  return snapshot.docs.map((record) => cleanFirestoreData<T>(record.data())).filter(Boolean) as T[];
}
