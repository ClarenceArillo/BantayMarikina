const axios = require('axios');
const crypto = require('crypto');
const { admin, db } = require('../firebase');

const WEATHER_DOC = db.collection('DashboardData').doc('weather');
const WATER_LEVEL_DOC = db.collection('DashboardData').doc('waterlevel');
const WEATHER_TTL_MS = 10 * 60 * 1000;
const WATER_LEVEL_TTL_MS = 5 * 60 * 1000;

const LAT = 14.6507;
const LON = 121.1029;

const STATION_MAP = {
  'Sto Nino': 'Sto Nino',
  Tumana: 'Tumana Bridge',
  Nangka: 'Nangka',
  Montalban: 'Montalban',
  Rodriguez: 'Rodriguez',
  Burgos: 'Burgos',
};

function getCondition(weatherCode) {
  if (weatherCode === 0) return 'Clear Sky';
  if (weatherCode <= 2) return 'Partly Cloudy';
  if (weatherCode === 3) return 'Overcast';
  if (weatherCode <= 49) return 'Foggy';
  if (weatherCode <= 59) return 'Drizzle';
  if (weatherCode <= 69) return 'Rainy';
  if (weatherCode <= 79) return 'Snowy';
  if (weatherCode <= 84) return 'Rain Showers';
  if (weatherCode <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function getDayName(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function parseLevel(wl) {
  if (!wl) return null;
  const cleaned = wl.toString().replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function getStatus(level, alertwl, alarmwl, criticalwl) {
  if (level === null || level === undefined) return 'Unavailable';
  if (criticalwl && level >= parseFloat(criticalwl)) return 'Critical';
  if (alarmwl && level >= parseFloat(alarmwl)) return 'Warning';
  if (alertwl && level >= parseFloat(alertwl)) return 'Warning';
  return 'Normal';
}

function buildHash(data) {
  return crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex');
}

function createUnavailableWeather() {
  return {
    location: 'Marikina City',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    temperature: null,
    humidity: null,
    windspeed: null,
    condition: 'Unavailable',
    forecast: [],
    updated_at: new Date().toISOString(),
  };
}

function createUnavailableWaterLevels() {
  return {
    stations: Object.keys(STATION_MAP).map((station) => ({
      station,
      level: null,
      status: 'Unavailable',
      last_reading: null,
    })),
    updated_at: new Date().toISOString(),
  };
}

function getCachedAtMillis(data) {
  const cachedAt = data?.cached_at;
  if (!cachedAt) return 0;
  if (typeof cachedAt.toMillis === 'function') return cachedAt.toMillis();
  if (typeof cachedAt === 'string') return new Date(cachedAt).getTime();
  if (typeof cachedAt === 'number') return cachedAt;
  return 0;
}

function isFresh(data, ttlMs) {
  const cachedAtMillis = getCachedAtMillis(data);
  return cachedAtMillis > 0 && Date.now() - cachedAtMillis < ttlMs;
}

function stripCacheMetadata(data) {
  if (!data) return null;
  const { cached_at, source_hash, ...publicData } = data;
  return publicData;
}

async function fetchWeatherFromApi() {
  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    timeout: 8000,
    params: {
      latitude: LAT,
      longitude: LON,
      current: 'temperature_2m,weathercode,relative_humidity_2m,windspeed_10m',
      daily: 'temperature_2m_max,temperature_2m_min,weathercode',
      timezone: 'Asia/Manila',
      forecast_days: 4,
    },
  });

  const data = response.data;
  const current = data.current;
  const daily = data.daily;

  const forecast = [1, 2, 3].map((i) => ({
    day: getDayName(daily.time[i]),
    temp_max: Math.round(daily.temperature_2m_max[i]),
    temp_min: Math.round(daily.temperature_2m_min[i]),
    condition: getCondition(daily.weathercode[i]),
  }));

  return {
    location: 'Marikina City',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    temperature: Math.round(current.temperature_2m),
    humidity: current.relative_humidity_2m,
    windspeed: current.windspeed_10m,
    condition: getCondition(current.weathercode),
    forecast,
    updated_at: new Date().toISOString(),
  };
}

async function fetchWaterLevelsFromApi() {
  const response = await axios.get(
    'https://pasig-marikina-tullahanffws.pagasa.dost.gov.ph/water/main_list.do',
    {
      timeout: 8000,
      params: { _: Date.now() },
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        isajax: 'true',
        'x-requested-with': 'XMLHttpRequest',
        referer: 'https://pasig-marikina-tullahanffws.pagasa.dost.gov.ph/',
      },
    }
  );

  const rawData = Array.isArray(response.data) ? response.data : response.data.value || [];
  const stations = Object.entries(STATION_MAP).map(([displayName, pagasaName]) => {
    const match = rawData.find((d) => d.obsnm === pagasaName);
    const level = match ? parseLevel(match.wl) : null;
    const status = match
      ? getStatus(level, match.alertwl, match.alarmwl, match.criticalwl)
      : 'Unavailable';

    return {
      station: displayName,
      level,
      status,
      last_reading: match ? match.timestr : null,
    };
  });

  return { stations, updated_at: new Date().toISOString() };
}

async function writeCacheDoc(docRef, data) {
  await docRef.set({
    ...data,
    source_hash: buildHash(data),
    cached_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return data;
}

async function refreshDoc(docRef, fetcher, { ttlMs, force = false, fallback } = {}) {
  const snapshot = await docRef.get();
  const cachedData = snapshot.exists ? snapshot.data() : null;

  if (!force && isFresh(cachedData, ttlMs)) {
    return stripCacheMetadata(cachedData);
  }

  let nextData;
  try {
    nextData = await fetcher();
  } catch (error) {
    if (cachedData) {
      console.error('Using stale dashboard cache after refresh failure:', error.message);
      return stripCacheMetadata(cachedData);
    }

    if (fallback) {
      console.error('Using fallback dashboard cache after refresh failure:', error.message);
      return writeCacheDoc(docRef, fallback());
    }

    throw error;
  }

  const nextHash = buildHash(nextData);

  if (!cachedData || cachedData.source_hash !== nextHash) {
    await docRef.set({
      ...nextData,
      source_hash: nextHash,
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return nextData;
  }

  await docRef.set(
    {
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return stripCacheMetadata(cachedData);
}

async function getCachedDoc(docRef, fetcher, ttlMs, fallback) {
  const snapshot = await docRef.get();
  if (snapshot.exists) {
    const data = snapshot.data();
    if (data) return stripCacheMetadata(data);
  }

  return refreshDoc(docRef, fetcher, { ttlMs, force: true, fallback });
}

function refreshWeather(options) {
  return refreshDoc(WEATHER_DOC, fetchWeatherFromApi, {
    fallback: createUnavailableWeather,
    ttlMs: WEATHER_TTL_MS,
    ...options,
  });
}

function refreshWaterLevels(options) {
  return refreshDoc(WATER_LEVEL_DOC, fetchWaterLevelsFromApi, {
    fallback: createUnavailableWaterLevels,
    ttlMs: WATER_LEVEL_TTL_MS,
    ...options,
  });
}

function getCachedWeather() {
  return getCachedDoc(WEATHER_DOC, fetchWeatherFromApi, WEATHER_TTL_MS, createUnavailableWeather);
}

function getCachedWaterLevels() {
  return getCachedDoc(
    WATER_LEVEL_DOC,
    fetchWaterLevelsFromApi,
    WATER_LEVEL_TTL_MS,
    createUnavailableWaterLevels
  );
}

async function warmDashboardCache() {
  const results = await Promise.allSettled([
    refreshWeather(),
    refreshWaterLevels(),
  ]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const name = index === 0 ? 'weather' : 'water level';
      console.error(`Failed to refresh ${name} cache:`, result.reason.message);
    }
  });
}

module.exports = {
  getCachedWeather,
  getCachedWaterLevels,
  refreshWeather,
  refreshWaterLevels,
  warmDashboardCache,
};
