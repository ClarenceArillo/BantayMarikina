const { admin, db } = require('../firebase');

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

function normalizeOfficialAlert(input = {}) {
  const hazardType = OFFICIAL_ALERT_TYPES.has(input.hazardType) ? input.hazardType : 'High Water Level';
  const severity = SEVERITIES.has(input.severity) ? input.severity : 'High';
  const title = String(input.title || `${hazardType} Alert in Marikina`).trim();
  const body = String(input.body || input.description || '').trim();
  const safetyTip = String(input.safetyTip || '').trim();
  const affectedArea = String(input.affectedArea || input.barangay || 'Marikina City').trim();

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
    sourceLabel: input.sourceLabel || 'OFFICIAL ALERT',
    priority: severity === 'Critical' ? 'critical' : 'high',
    hazardType,
    severity,
    title,
    body,
    safetyTip,
    affectedArea,
    barangay: affectedArea,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : null,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : null,
    createdBy: input.createdBy || 'system',
    createdByRole: input.createdByRole || 'admin',
    provider: input.provider || 'BantayMarikina Admin',
    providerReference: input.providerReference || null,
    officialAlertKey: input.officialAlertKey || null,
    officialEventId: input.officialEventId || input.providerReference || null,
    sourceUrl: input.sourceUrl || null,
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

async function upsertLatestOfficialHazardAlert(input = {}) {
  const alert = normalizeOfficialAlert(input);
  const eventId = alert.officialEventId || input.dedupeKey || alert.providerReference || `${alert.hazardType}-${alert.affectedArea}`;
  const docId = `official_${slugify(alert.officialAlertKey || alert.hazardType)}_${slugify(eventId)}`;
  const docRef = db.collection(NOTIFICATIONS_COLLECTION).doc(docId);

  await docRef.set(alert, { merge: true });
  await deleteOlderOfficialAlerts(alert.officialAlertKey, docId);
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
