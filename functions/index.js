const admin = require('firebase-admin');
const crypto = require('crypto');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function categoryLabel(category) {
  return String(category || 'other').replace(/_/g, ' ');
}

function getCloudinaryConfig() {
  if (!process.env.CLOUDINARY_URL) {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET ||
      process.env.CLOUDINARY_API_SECRET === 'your_cloudinary_api_secret'
    ) {
      return null;
    }

    return {
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }

  try {
    const parsed = new URL(process.env.CLOUDINARY_URL);
    return { apiKey: parsed.username, apiSecret: parsed.password, cloudName: parsed.hostname };
  } catch {
    return null;
  }
}

function signCloudinaryParams(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

async function destroyCloudinaryAsset(media) {
  const config = getCloudinaryConfig();
  if (!config || !media?.public_id) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    api_key: config.apiKey,
    public_id: media.public_id,
    signature: signCloudinaryParams({ public_id: media.public_id, timestamp }, config.apiSecret),
    timestamp: String(timestamp),
  });

  const resourceType = media.resource_type === 'video' ? 'video' : 'image';
  let response = null;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/destroy`, {
        method: 'POST',
        body,
        signal: controller.signal,
      });
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    } finally {
      clearTimeout(timeout);
    }

    await sleep(500 * (attempt + 1));
  }

  if (!response?.ok) {
    logger.warn('Unable to destroy Cloudinary asset', { publicId: media.public_id, status: response?.status || null });
    if (lastError) logger.warn('Cloudinary destroy error', lastError);
  }
}

async function cleanupReportMedia(report) {
  const assets = Array.isArray(report.media) ? report.media : [];
  if (report.cloudinaryMedia) assets.push(report.cloudinaryMedia);

  const unique = new Map(assets.filter((asset) => asset?.public_id).map((asset) => [asset.public_id, asset]));
  await Promise.all([...unique.values()].map(destroyCloudinaryAsset));
}

exports.onReportCreated = onDocumentCreated('Reports/{reportId}', async (event) => {
  const report = event.data && event.data.data();
  if (!report) return;

  const reportId = event.params.reportId;
  const title = report.title || `${report.severity || 'Live'} ${report.hazardType || report.hazard_type || 'Hazard'}`;
  const body = report.description || 'A new community hazard report was submitted.';

  await messaging.send({
    topic: 'communityReports',
    notification: {
      title,
      body,
    },
    data: {
      type: 'new_report',
      reportId,
      hazardType: String(report.hazardType || report.hazard_type || 'Hazard'),
      severity: String(report.severity || 'Moderate'),
    },
  }).catch((error) => {
    logger.warn('Unable to send community report FCM topic message', error);
  });

  await db.collection('Notifications').doc(`report_${reportId}`).set({
    audience: 'all',
    type: 'new_report',
    reportId,
    title,
    body,
    hazardType: report.hazardType || report.hazard_type || 'Hazard',
    severity: report.severity || 'Moderate',
    imageUrl: report.imageUrl || report.image_url || null,
    latitude: report.latitude || null,
    longitude: report.longitude || null,
    barangay: report.barangay || '',
    reporterName: report.reporterName || 'Resident',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
});

exports.onReportRemoved = onDocumentUpdated('Reports/{reportId}', async (event) => {
  const before = event.data && event.data.before.data();
  const after = event.data && event.data.after.data();
  if (!before || !after) return;

  const wasRemoved = before.moderationStatus === 'removed' || before.status === 'rejected';
  const isRemoved = after.moderationStatus === 'removed' || after.status === 'rejected';

  if (wasRemoved || !isRemoved || !after.userId) return;

  await cleanupReportMedia(after).catch((error) => {
    logger.warn('Unable to clean Cloudinary media for removed report', error);
  });

  const dominantCategory = after.removedReason || 'other';
  await db.collection('Notifications').add({
    audience: 'user',
    recipientId: after.userId,
    type: 'moderation_removed',
    reportId: event.params.reportId,
    title: 'Report removed',
    body: `Your report has been removed due to multiple community reports for ${categoryLabel(dominantCategory)}.`,
    hazardType: after.hazardType || after.hazard_type || 'Hazard',
    severity: after.severity || 'Moderate',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

exports.onReportDeleted = onDocumentDeleted('Reports/{reportId}', async (event) => {
  const report = event.data && event.data.data();
  if (!report) return;

  await cleanupReportMedia(report).catch((error) => {
    logger.warn('Unable to clean Cloudinary media for deleted report', error);
  });
});
