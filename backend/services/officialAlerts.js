const { admin, db } = require('../firebase');
const { sanitizeText } = require('../middleware/security');

const NOTIFICATIONS_COLLECTION = 'Notifications';
const OFFICIAL_ALERT_TYPES = new Set(['Earthquake', 'Typhoon', 'Extreme Heat', 'High Water Level', 'Flood']);
const SEVERITIES = new Set(['Low', 'Moderate', 'High', 'Critical']);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (value && typeof value.toDate === 'function') {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getSignalLevel(severity, hazardType) {
  if (hazardType === 'Typhoon') {
    if (severity === 'Critical') return 5;
    if (severity === 'High') return 4;
    if (severity === 'Moderate') return 2;
    return 1;
  }

  if (hazardType === 'Earthquake') {
    if (severity === 'Critical') return 5;
    if (severity === 'High') return 4;
    if (severity === 'Moderate') return 3;
    return 1;
  }

  if (severity === 'Critical') return 5;
  if (severity === 'High') return 4;
  if (severity === 'Moderate') return 3;
  return 1;
}

function shouldNotifyOfficialAlert({ hazardType, severity, magnitude, signalLevel }) {
  if (hazardType === 'Earthquake') {
    return Number.isFinite(Number(magnitude)) && Number(magnitude) >= 4;
  }

  if (hazardType === 'Typhoon') {
    return Number.isFinite(Number(signalLevel)) && Number(signalLevel) >= 2;
  }

  return ['High', 'Critical'].includes(severity);
}

function normalizeOfficialAlert(input = {}) {
  const hazardType = OFFICIAL_ALERT_TYPES.has(input.hazardType) ? input.hazardType : 'High Water Level';
  const severity = SEVERITIES.has(input.severity) ? input.severity : 'High';
  const magnitude = Number.isFinite(Number(input.magnitude)) ? Number(input.magnitude) : null;
  const intensity = Number.isFinite(Number(input.intensity)) ? Number(input.intensity) : null;
  const signalLevel = Number.isFinite(Number(input.signalLevel)) ? Number(input.signalLevel) : getSignalLevel(severity, hazardType);
  const shouldNotify = typeof input.shouldNotify === 'boolean' ? input.shouldNotify : shouldNotifyOfficialAlert({ hazardType, severity, magnitude, signalLevel });
  const title = sanitizeText(input.title || `${hazardType} Alert in Marikina`, 120);
  const body = sanitizeText(input.body || input.description || '', 500);
  const safetyTip = sanitizeText(input.safetyTip || '', 240);
  const affectedArea = sanitizeText(input.affectedArea || input.barangay || 'Marikina City', 120);

  if (!body || body.length < 12) {
    throw new Error('Official alert body must be at least 12 characters.');
  }

  if (!safetyTip || safetyTip.length < 8) {
    throw new Error('Official alert safetyTip must be at least 8 characters.');
  }

  const issuedAt = input.issuedAt instanceof Date && !Number.isNaN(input.issuedAt.getTime())
    ? admin.firestore.Timestamp.fromDate(input.issuedAt)
    : null;

  return {
    audience: 'all',
    type: 'official_alert',
    source: 'official',
    sourceLabel: sanitizeText(input.sourceLabel || 'OFFICIAL ALERT', 40),
    priority: severity === 'Critical' ? 'critical' : severity === 'High' ? 'high' : 'normal',
    hazardType,
    severity,
    title,
    body,
    safetyTip,
    affectedArea,
    barangay: affectedArea,
    magnitude,
    intensity,
    signalLevel,
    shouldNotify,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : null,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : null,
    createdBy: input.createdBy || 'system',
    createdByRole: input.createdByRole || 'admin',
    provider: sanitizeText(input.provider || 'BantayMarikina Admin', 80),
    providerReference: input.providerReference ? sanitizeText(input.providerReference, 120) : null,
    officialAlertKey: input.officialAlertKey ? sanitizeText(input.officialAlertKey, 80) : null,
    officialEventId: input.officialEventId ? sanitizeText(input.officialEventId, 120) : input.providerReference ? sanitizeText(input.providerReference, 120) : null,
    sourceUrl: input.sourceUrl ? String(input.sourceUrl).trim().slice(0, 500) : null,
    createdAt: issuedAt || admin.firestore.FieldValue.serverTimestamp(),
    issuedAt: issuedAt || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildOfficialAlertId(alert, dedupeKey) {
  if (dedupeKey) return `official_${slugify(dedupeKey)}`;
  const nowBucket = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `official_${slugify(alert.hazardType)}_${slugify(alert.affectedArea)}_${nowBucket}`;
}

async function createOfficialHazardAlert(input = {}) {
  const alert = normalizeOfficialAlert(input);
  const docId = buildOfficialAlertId(alert, input.dedupeKey || input.providerReference);
  const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(docId);

  await docRef.set(alert, { merge: true });
  return { id: docId, ...alert };
}

async function deleteOlderOfficialAlerts(officialAlertKey, currentDocId) {
  if (!officialAlertKey) return;

  const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
    .where('officialAlertKey', '==', officialAlertKey)
    .limit(20)
    .get();
  const batch = db.batch();
  let deleteCount = 0;

  snapshot.docs.forEach((document) => {
    if (document.id === currentDocId) return;
    batch.delete(document.ref);
    deleteCount += 1;
  });

  if (deleteCount > 0) await batch.commit();
}

async function pruneOlderOfficialAlerts() {
  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
  const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
    .where('type', '==', 'official_alert')
    .get();
  const batch = db.batch();
  let deleteCount = 0;

  snapshot.docs.forEach((document) => {
    const data = document.data();
    const documentDate = toDate(data.issuedAt) || toDate(data.createdAt);
    if (documentDate && documentDate < currentYearStart) {
      batch.delete(document.ref);
      deleteCount += 1;
    }
  });

  if (deleteCount > 0) await batch.commit();
}

async function upsertLatestOfficialHazardAlert(input = {}) {
  const alert = normalizeOfficialAlert(input);
  const eventId = alert.officialEventId || input.dedupeKey || alert.providerReference || `${alert.hazardType}-${alert.affectedArea}`;
  const docId = `official_${slugify(alert.officialAlertKey || alert.hazardType)}_${slugify(eventId)}`;
  const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(docId);

  await docRef.set(alert, { merge: true });
  await pruneOlderOfficialAlerts();
  return { id: docId, ...alert };
}

function buildExtremeHeatAlert({ heatIndex, area = 'Marikina City' } = {}) {
  if (!Number.isFinite(Number(heatIndex)) || Number(heatIndex) < 42) return null;

  return {
    hazardType: 'Extreme Heat',
    severity: Number(heatIndex) >= 52 ? 'Critical' : 'High',
    title: 'Extreme Heat Detected in Marikina',
    body: `Heat index is around ${Number(heatIndex).toFixed(0)}°C. Stay hydrated, avoid direct sunlight, and limit outdoor activities between 10AM-4PM.`,
    safetyTip: 'Drink water often and rest in shade or a cool room.',
    affectedArea: area,
    provider: 'Automated Weather Monitor',
    dedupeKey: `extreme-heat-${area}-${new Date().toISOString().slice(0, 10)}`,
  };
}

function buildHighWaterAlert({ station, level, status, area = 'Marikina City' } = {}) {
  const cleanStatus = String(status || '').toLowerCase();
  if (!['warning', 'critical'].includes(cleanStatus)) return null;

  return {
    hazardType: 'High Water Level',
    severity: cleanStatus === 'critical' ? 'Critical' : 'High',
    title: `${cleanStatus === 'critical' ? 'Critical' : 'High'} Water Level Alert`,
    body: `${station || 'A monitored river station'} reports elevated water level${Number.isFinite(Number(level)) ? ` at ${Number(level).toFixed(2)}m` : ''}. Prepare to move to higher ground if advised.`,
    safetyTip: 'Avoid riverbanks and evacuate early if water keeps rising.',
    affectedArea: area,
    provider: 'Automated Water Level Monitor',
    dedupeKey: `water-${station || area}-${cleanStatus}-${new Date().toISOString().slice(0, 10)}`,
  };
}

module.exports = {
  buildExtremeHeatAlert,
  buildHighWaterAlert,
  createOfficialHazardAlert,
  normalizeOfficialAlert,
  upsertLatestOfficialHazardAlert,
};
