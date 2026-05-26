const axios = require('axios');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { upsertLatestOfficialHazardAlert } = require('./officialAlerts');

const PAGASA_META_URL = 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/metafile.txt';
const PAGASA_CYCLONE_URL = 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/cyclone.dat';
const PHIVOLCS_LATEST_URL = 'https://tsunami.phivolcs.dost.gov.ph/EQLatest.html';
const PAGASA_INTERVAL_MS = Number(process.env.PAGASA_ALERT_POLL_MS || 30 * 60 * 1000);
const PHIVOLCS_INTERVAL_MS = Number(process.env.PHIVOLCS_ALERT_POLL_MS || 5 * 60 * 1000);
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

const httpClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 6 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 6 }),
  timeout: REQUEST_TIMEOUT_MS,
  responseType: 'text',
  transformResponse: [(data) => data],
  headers: {
    'User-Agent': 'BantayMarikina/1.0 official-alert-poller',
  },
});

const pollState = {
  pagasa: { running: false, timer: null, failures: 0, lastEventId: null },
  phivolcs: { running: false, timer: null, failures: 0, lastEventId: null },
};

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&deg;|º/g, '°')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePagasaIssuedAt(metaText) {
  const match = String(metaText || '').match(/RPMM\s+(\d{8})\s+(\d{4})\s+UTC/i);
  if (!match) return null;

  const [, datePart, timePart] = match;
  const date = new Date(Date.UTC(
    Number(datePart.slice(0, 4)),
    Number(datePart.slice(4, 6)) - 1,
    Number(datePart.slice(6, 8)),
    Number(timePart.slice(0, 2)),
    Number(timePart.slice(2, 4))
  ));

  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePagasaStormName(metaText) {
  const advisoryMatch = String(metaText || '').match(/#TC ADVISORIES AND WARNINGS\s+([^;]+)/i);
  if (advisoryMatch) return advisoryMatch[1].trim();

  const localMatch = String(metaText || '').match(/LOCAL TC WARNING\s+([^;#]+)/i);
  return localMatch ? localMatch[1].trim() : 'Active Tropical Cyclone';
}

function parseCycloneDat(cycloneText) {
  const lines = String(cycloneText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const forecastLine = lines.find((line) => /^[A-Z]{1,4},\d{4}-\d{2}-\d{2},/.test(line));
  if (!forecastLine) return null;

  const [stage, date, time, latitude, longitude] = forecastLine.split(',').map((part) => part.trim());
  return {
    stage,
    date,
    time,
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

function getPagasaSeverity(stage) {
  if (stage === 'TY' || stage === 'STY') return 'Critical';
  if (stage === 'STS' || stage === 'TS') return 'High';
  return 'Moderate';
}

async function fetchLatestPagasaAlert() {
  const [metaResponse, cycloneResponse] = await Promise.all([
    httpClient.get(PAGASA_META_URL),
    httpClient.get(PAGASA_CYCLONE_URL),
  ]);
  const metaText = String(metaResponse.data || '');
  const cycloneText = String(cycloneResponse.data || '');
  const issuedAt = parsePagasaIssuedAt(metaText) || new Date();
  const stormName = parsePagasaStormName(metaText);
  const cyclone = parseCycloneDat(cycloneText);
  const eventId = hash(`${stormName}|${issuedAt.toISOString()}|${cycloneText.slice(0, 160)}`);
  const severity = getPagasaSeverity(cyclone?.stage);
  const stageLabel = cyclone?.stage ? `${cyclone.stage} ` : '';

  return {
    officialAlertKey: 'latest-pagasa-typhoon',
    officialEventId: eventId,
    hazardType: 'Typhoon',
    severity,
    sourceLabel: 'ADMIN VERIFIED',
    title: `${stageLabel}Typhoon Warning Issued`,
    body: `${stormName} bulletin from DOST-PAGASA${cyclone ? ` near ${cyclone.latitude.toFixed(1)}°N, ${cyclone.longitude.toFixed(1)}°E` : ''}. Monitor official advisories and prepare for strong rain or wind conditions.`,
    safetyTip: 'Stay indoors, charge devices, and avoid flooded roads.',
    affectedArea: 'Philippines / Marikina City monitoring',
    provider: 'DOST-PAGASA',
    providerReference: eventId,
    sourceUrl: 'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin',
    issuedAt,
  };
}

function parsePhivolcsLatestEvent(html) {
  const marker = '<!------------------------------------------------------------------------------- enter new event below';
  const markerIndex = html.indexOf(marker);
  const tableHtml = markerIndex >= 0 ? html.slice(markerIndex) : html;
  const rowMatch = tableHtml.match(/<tr[\s\S]*?<\/tr>/i);
  if (!rowMatch) return null;

  const row = rowMatch[0];
  const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/gi)].map((match) => cleanText(match[0]));
  if (cells.length < 6) return null;

  const [dateTimeText, latitudeText, longitudeText, depthText, magnitudeText, locationText] = cells;
  const bulletinHref = row.match(/href=["']([^"']+)["']/i)?.[1]?.replace(/\\/g, '/');
  const magnitude = Number(magnitudeText);
  const issuedAt = parsePhivolcsDate(dateTimeText);

  return {
    dateTimeText,
    issuedAt,
    latitude: Number(latitudeText),
    longitude: Number(longitudeText),
    depth: Number(depthText),
    magnitude,
    location: locationText,
    bulletinUrl: bulletinHref ? new URL(bulletinHref, 'https://earthquake.phivolcs.dost.gov.ph/').toString() : PHIVOLCS_LATEST_URL,
  };
}

function parsePhivolcsDate(value) {
  const match = String(value || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+-\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const [, day, monthName, year, hourRaw, minute, ampm] = match;
  let hour = Number(hourRaw);
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;

  const date = new Date(Number(year), months[monthName.toLowerCase()], Number(day), hour, Number(minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEarthquakeSeverity(magnitude) {
  if (magnitude >= 6) return 'Critical';
  if (magnitude >= 5) return 'High';
  if (magnitude >= 4) return 'Moderate';
  return 'Low';
}

async function fetchLatestPhivolcsAlert() {
  const response = await httpClient.get(PHIVOLCS_LATEST_URL);
  const event = parsePhivolcsLatestEvent(String(response.data || ''));
  if (!event) throw new Error('Unable to parse PHIVOLCS latest earthquake table.');

  const eventId = hash(`${event.dateTimeText}|${event.latitude}|${event.longitude}|${event.depth}|${event.magnitude}|${event.location}`);
  return {
    officialAlertKey: 'latest-phivolcs-earthquake',
    officialEventId: eventId,
    hazardType: 'Earthquake',
    severity: getEarthquakeSeverity(event.magnitude),
    sourceLabel: 'ADMIN VERIFIED',
    title: `Magnitude ${event.magnitude.toFixed(1)} Earthquake Detected`,
    body: `PHIVOLCS recorded a magnitude ${event.magnitude.toFixed(1)} earthquake ${event.location}. Depth: ${Number.isFinite(event.depth) ? `${event.depth} km` : 'not available'}.`,
    safetyTip: 'Drop, Cover, and Hold. Stay away from windows and heavy objects.',
    affectedArea: event.location || 'Philippines / Marikina City monitoring',
    latitude: event.latitude,
    longitude: event.longitude,
    provider: 'DOST-PHIVOLCS',
    providerReference: eventId,
    sourceUrl: event.bulletinUrl,
    issuedAt: event.issuedAt || new Date(),
  };
}

function scheduleNext(source, fn, baseIntervalMs) {
  const state = pollState[source];
  const delay = Math.min(baseIntervalMs + (state.failures ? 60_000 * 2 ** Math.min(state.failures, 4) : 0), MAX_BACKOFF_MS);
  state.timer = setTimeout(() => runPoll(source, fn, baseIntervalMs), delay);
  state.timer.unref?.();
}

async function runPoll(source, fn, baseIntervalMs) {
  const state = pollState[source];
  if (state.running) return scheduleNext(source, fn, baseIntervalMs);

  state.running = true;
  try {
    const alert = await fn();
    if (alert.officialEventId !== state.lastEventId) {
      await upsertLatestOfficialHazardAlert(alert);
      state.lastEventId = alert.officialEventId;
    }
    state.failures = 0;
  } catch (error) {
    state.failures += 1;
    console.warn(JSON.stringify({
      level: 'warn',
      service: 'official-alert-poller',
      source,
      message: error.message,
      failures: state.failures,
      timestamp: new Date().toISOString(),
    }));
  } finally {
    state.running = false;
    scheduleNext(source, fn, baseIntervalMs);
  }
}

function startOfficialAlertPolling() {
  if (!pollState.pagasa.timer) runPoll('pagasa', fetchLatestPagasaAlert, PAGASA_INTERVAL_MS);
  if (!pollState.phivolcs.timer) runPoll('phivolcs', fetchLatestPhivolcsAlert, PHIVOLCS_INTERVAL_MS);
}

function stopOfficialAlertPolling() {
  Object.values(pollState).forEach((state) => {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.running = false;
  });
}

module.exports = {
  fetchLatestPagasaAlert,
  fetchLatestPhivolcsAlert,
  parsePhivolcsLatestEvent,
  startOfficialAlertPolling,
  stopOfficialAlertPolling,
};
