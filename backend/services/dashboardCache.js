const axios = require('axios');
const crypto = require('crypto');
const { admin, db } = require('../firebase');

const WEATHER_DOC = db.collection('DashboardData').doc('weather');
const WATER_LEVEL_DOC = db.collection('DashboardData').doc('waterlevel');
const WEATHER_TTL_MS = 10 * 60 * 1000;
const WATER_LEVEL_TTL_MS = 5 * 60 * 1000;
const BANTAYBAHA_URL = 'https://bantaybaha.com/marikina';
const BANTAYBAHA_TIMEOUT_MS = 30000;
const PANAHON_URL = 'https://panahon.gov.ph';
const PANAHON_TIMEOUT_MS = 30000;

const LAT = 14.6507;
const LON = 121.1029;

const STATION_MAP = {
  'Sto Nino': 'Sto. Niño',
  Tumana: 'Tumana Bridge',
  Nangka: 'Nangka',
  Montalban: 'San Mateo I',
  Rodriguez: 'Rodriguez 1',
  Burgos: 'Burgos',
};

const OLD_FFWS_STATION_MAP = {
  'Sto Nino': 'Sto Nino',
  Tumana: 'Tumana Bridge',
  Nangka: 'Nangka',
  Montalban: 'Montalban',
  Rodriguez: 'Rodriguez',
  Burgos: 'Burgos',
};

const BANTAYBAHA_STATION_MAP = {
  'Sto Nino': 'Sto Nino',
  Rodriguez: 'Rodriguez',
  'San Jose': 'San Jose',
  Batasan: 'Batasan',
  Nangka: 'Nangka',
  Tumana: 'Tumana',
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
  if (wl === null || wl === undefined || wl === '') return null;
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

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, 'n')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function extractBantayBahaPageData(html) {
  const match = String(html || '').match(/<div\s+id="app"[^>]*\sdata-page="([^"]+)"/);
  if (!match) {
    throw new Error('BantayBaha data-page payload was not found');
  }

  return JSON.parse(decodeHtmlAttribute(match[1]));
}

function normalizeBantayBahaStatus(status) {
  const value = String(status?.name || status?.value || '').trim().toLowerCase();
  if (value === 'critical' || value === '3rd alarm') return 'Critical';
  if (value === 'warning' || value === 'alert' || value === '2nd alarm' || value === '1st alarm') {
    return 'Warning';
  }
  if (value === 'normal') return 'Normal';
  return value ? String(status.name || status.value) : 'Unavailable';
}

function normalizeBantayBahaGauge(gauge, fallbackLabel) {
  const level = parseLevel(gauge?.currentValue ?? gauge?.values?.current);

  return {
    station: fallbackLabel,
    level,
    status: level === null ? 'Unavailable' : normalizeBantayBahaStatus(gauge?.status),
    last_reading: gauge?.measuredAt || null,
    source_station: gauge?.label || fallbackLabel,
    trend: gauge?.trend || null,
    alarms: Array.isArray(gauge?.alarms) ? gauge.alarms : [],
    values: gauge?.values || null,
  };
}

function buildRecordId(prefix, observedAt = new Date().toISOString()) {
  const safeTime = String(observedAt)
    .replace(/[^0-9a-z]/gi, '')
    .slice(0, 32);
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${safeTime || Date.now()}_${suffix}`;
}

function getStableDataHash(data) {
  const {
    cached_at,
    last_checked_at,
    recorded_at,
    source_hash,
    source_message,
    source_status,
    raw_source_data,
    updated_at,
    ...stableData
  } = data || {};

  return buildHash(stableData);
}

function getPublicData(data) {
  if (!data) return null;
  const { raw_source_data, ...publicData } = data;
  return publicData;
}

function getSourceHealth(data) {
  if (Array.isArray(data?.stations) && data.stations.length > 0) {
    const hasReading = data.stations.some((station) => station.level !== null && station.level !== undefined);
    return hasReading
      ? { status: 'ok', message: null }
      : {
          status: 'no_readings',
          message: 'Official water level source returned null readings for the configured stations',
        };
  }

  return { status: 'ok', message: null };
}

async function writeRecordDoc(docRef, prefix, data, { status = 'ok', message = null, raw = null } = {}) {
  const checkedAt = new Date().toISOString();
  const publicData = getPublicData(data);
  const recordData = {
    ...publicData,
    source_status: status,
    source_message: message,
    checked_at: checkedAt,
    source_hash: getStableDataHash(publicData),
    recorded_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (data?.raw_source_data !== null && data?.raw_source_data !== undefined) {
    recordData.raw_source_data = data.raw_source_data;
  } else if (raw !== null && raw !== undefined) {
    recordData.raw_source_data = raw;
  }

  await docRef.collection('records').doc(buildRecordId(prefix, checkedAt)).set(recordData);
}

async function getPanahonToken() {
  const response = await axios.get(PANAHON_URL, {
    timeout: PANAHON_TIMEOUT_MS,
    headers: { 'user-agent': 'Mozilla/5.0' },
  });

  const token = String(response.data || '').match(/name="csrf-token" content="([^"]+)/)?.[1];
  if (!token) {
    throw new Error('PANaHON token was not found');
  }

  return token;
}

function createUnavailableWeather(error) {
  return {
    location: 'Marikina City',
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    temperature: null,
    humidity: null,
    windspeed: null,
    condition: 'Unavailable',
    forecast: [],
    updated_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    source_status: 'error',
    source_message: error?.message || 'Weather source unavailable',
  };
}

function createUnavailableWaterLevels(error) {
  return {
    stations: Object.keys(BANTAYBAHA_STATION_MAP).map((station) => ({
      station,
      level: null,
      status: 'Unavailable',
      last_reading: null,
    })),
    updated_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    source_status: 'error',
    source_message: error?.message || 'Water level source unavailable',
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
    source: 'open-meteo',
    source_observed_at: current.time,
    updated_at: new Date().toISOString(),
    raw_source_data: data,
  };
}

async function fetchWaterLevelsFromBantayBaha() {
  const response = await axios.get(BANTAYBAHA_URL, {
    timeout: BANTAYBAHA_TIMEOUT_MS,
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0',
    },
  });

  const pageData = extractBantayBahaPageData(response.data);
  const props = pageData?.props || {};
  const gauges = [
    props.mainRiverWaterLevelGauge,
    ...(Array.isArray(props.upstreamWaterLevelGauges) ? props.upstreamWaterLevelGauges : []),
    ...(Array.isArray(props.nearbyRiverWaterLevelGauges) ? props.nearbyRiverWaterLevelGauges : []),
  ].filter(Boolean);

  if (gauges.length === 0) {
    throw new Error('BantayBaha returned no water level gauges');
  }

  const stations = Object.entries(BANTAYBAHA_STATION_MAP).map(([displayName, sourceName]) => {
    const normalizedSourceName = normalizeName(sourceName);
    const match = gauges.find((gauge) => normalizeName(gauge.label) === normalizedSourceName);
    return normalizeBantayBahaGauge(match, displayName);
  });

  const hasReading = stations.some((station) => station.level !== null && station.level !== undefined);
  if (!hasReading) {
    throw new Error('BantayBaha returned no configured station readings');
  }

  return {
    stations,
    source: 'bantaybaha-marikina',
    source_observed_at: stations.find((station) => station.last_reading)?.last_reading || null,
    updated_at: new Date().toISOString(),
    raw_station_count: gauges.length,
    raw_source_data: {
      id: props.id,
      name: props.name,
      slug: props.slug,
      mainRiverWaterLevelGauge: props.mainRiverWaterLevelGauge,
      upstreamWaterLevelGauges: props.upstreamWaterLevelGauges || [],
      nearbyRiverWaterLevelGauges: props.nearbyRiverWaterLevelGauges || [],
      url: pageData.url,
      version: pageData.version,
    },
  };
}

async function fetchWaterLevelsFromPanahon() {
  const token = await getPanahonToken();
  const response = await axios.get(`${PANAHON_URL}/api/v1/riverbasin/waterlevel`, {
    timeout: PANAHON_TIMEOUT_MS,
    params: {
      token,
      parameter: 'waterlevel',
    },
    headers: {
      accept: 'application/json',
      referer: `${PANAHON_URL}/`,
      'user-agent': 'Mozilla/5.0',
    },
  });

  const rawData = Array.isArray(response.data?.data) ? response.data.data : [];
  if (!response.data?.success || rawData.length === 0) {
    throw new Error('PANaHON returned no water level data');
  }

  const stations = Object.entries(STATION_MAP).map(([displayName, sourceName]) => {
    const normalizedSourceName = normalizeName(sourceName);
    const match = rawData.find((item) => normalizeName(item.site_name) === normalizedSourceName);
    const level = match ? parseLevel(match.value) : null;

    return {
      station: displayName,
      level,
      status: level === null ? 'Unavailable' : 'Normal',
      last_reading: match?.observed_at || null,
      source_station: match?.site_name || sourceName,
    };
  });

  const hasStationMatch = stations.some((station) => station.last_reading);
  if (!hasStationMatch) {
    throw new Error('PANaHON did not include configured Marikina water level stations');
  }

  return {
    stations,
    source: 'panahon-riverbasin',
    source_observed_at: stations.find((station) => station.last_reading)?.last_reading || null,
    updated_at: new Date().toISOString(),
    raw_station_count: rawData.length,
    raw_source_data: rawData,
  };
}

async function fetchWaterLevelsFromOldFfws() {
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
  const stations = Object.entries(OLD_FFWS_STATION_MAP).map(([displayName, pagasaName]) => {
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
      source_station: match ? match.obsnm : pagasaName,
    };
  });

  return {
    stations,
    source: 'old-pagasa-ffws',
    source_observed_at: stations.find((station) => station.last_reading)?.last_reading || null,
    updated_at: new Date().toISOString(),
    raw_station_count: rawData.length,
    raw_source_data: rawData,
  };
}

async function fetchWaterLevelsFromApi() {
  try {
    return await fetchWaterLevelsFromBantayBaha();
  } catch (bantayBahaError) {
    try {
      return await fetchWaterLevelsFromPanahon();
    } catch (panahonError) {
      try {
        return await fetchWaterLevelsFromOldFfws();
      } catch (oldFfwsError) {
        throw new Error(
          `Water level sources unavailable. BantayBaha: ${bantayBahaError.message}; PANaHON: ${panahonError.message}; Old FFWS: ${oldFfwsError.message}`
        );
      }
    }
  }
}

async function writeCacheDoc(docRef, data) {
  await docRef.set({
    ...data,
    source_hash: buildHash(data),
    cached_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return data;
}

async function updateLatestDoc(docRef, nextData, cachedData) {
  const publicData = getPublicData(nextData);
  const nextHash = getStableDataHash(publicData);

  if (
    !cachedData ||
    cachedData.source_hash !== nextHash ||
    cachedData.source_status !== publicData.source_status ||
    cachedData.source_message !== publicData.source_message
  ) {
    await docRef.set({
      ...publicData,
      source_hash: nextHash,
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return publicData;
}

async function refreshDoc(docRef, fetcher, { ttlMs, force = false, fallback, recordPrefix } = {}) {
  const snapshot = await docRef.get();
  const cachedData = snapshot.exists ? snapshot.data() : null;

  if (!force && isFresh(cachedData, ttlMs)) {
    return stripCacheMetadata(cachedData);
  }

  let nextData;
  try {
    nextData = await fetcher();
  } catch (error) {
    const sourceError = {
      last_checked_at: new Date().toISOString(),
      source_status: 'error',
      source_message: error.message || 'Source refresh failed',
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (cachedData) {
      console.error('Using stale dashboard cache after refresh failure:', error.message);
      await writeRecordDoc(docRef, recordPrefix, stripCacheMetadata(cachedData), {
        status: 'error',
        message: error.message || 'Source refresh failed',
      });
      if (cachedData.source_status !== 'error' || cachedData.source_message !== sourceError.source_message) {
        await docRef.set(sourceError, { merge: true });
      }
      return stripCacheMetadata({
        ...cachedData,
        ...sourceError,
        cached_at: cachedData.cached_at,
      });
    }

    if (fallback) {
      console.error('Using fallback dashboard cache after refresh failure:', error.message);
      const fallbackData = fallback(error);
      await writeRecordDoc(docRef, recordPrefix, fallbackData, {
        status: 'error',
        message: error.message || 'Source refresh failed',
      });
      return writeCacheDoc(docRef, fallbackData);
    }

    throw error;
  }

  const now = new Date().toISOString();
  const sourceHealth = getSourceHealth(nextData);
  nextData = {
    ...nextData,
    last_checked_at: now,
    source_status: sourceHealth.status,
    source_message: sourceHealth.message,
  };

  await writeRecordDoc(docRef, recordPrefix, nextData, sourceHealth);
  return updateLatestDoc(docRef, nextData, cachedData);
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
    recordPrefix: 'weather',
    ttlMs: WEATHER_TTL_MS,
    ...options,
  });
}

function refreshWaterLevels(options) {
  return refreshDoc(WATER_LEVEL_DOC, fetchWaterLevelsFromApi, {
    fallback: createUnavailableWaterLevels,
    recordPrefix: 'waterlevel',
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
