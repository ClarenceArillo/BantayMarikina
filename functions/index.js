const admin = require('firebase-admin');
const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();
const MODERATION_CATEGORIES = [
  'false_report',
  'inaccurate_image',
  'misleading_information',
  'spam',
  'other',
];
const AUTO_TAKEDOWN_FLAG_THRESHOLD = 5;
const REPORT_SUBCOLLECTIONS = ['likes', 'comments', 'userViews', 'userReports'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function categoryLabel(category) {
  return String(category || 'other').replace(/_/g, ' ');
}

function cleanText(value, fallback = '', max = 240) {
  return String(value || fallback)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function getDominantCategory(categories) {
  return MODERATION_CATEGORIES.reduce((dominant, category) => {
    return (categories[category] || 0) > (categories[dominant] || 0) ? category : dominant;
  }, 'other');
}

async function updateReportCounter(reportId, field, delta) {
  if (!reportId || !Number.isFinite(delta) || delta === 0) return;

  const reportRef = db.collection('Reports').doc(reportId);
  await db.runTransaction(async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    if (!reportSnapshot.exists) return;

    transaction.update(reportRef, {
      [field]: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }).catch((error) => {
    logger.warn('Unable to update report counter', { reportId, field, error: error.message });
  });
}

async function deleteQuerySnapshotInBatches(query, label) {
  let snapshot = await query.limit(400).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
    await batch.commit();
    logger.info('Deleted related Firestore documents', { label, count: snapshot.size });
    snapshot = await query.limit(400).get();
  }
}

async function cleanupReportNotifications(reportId) {
  let snapshot = await db.collection('Notifications').where('reportId', '==', reportId).limit(400).get();

  while (!snapshot.empty) {
    const notificationIds = snapshot.docs.map((documentSnapshot) => documentSnapshot.id);
    const batch = db.batch();
    snapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
    await batch.commit();

    await Promise.all(notificationIds.map((notificationId) => deleteQuerySnapshotInBatches(
      db.collection('NotificationReads').where('notificationId', '==', notificationId),
      `NotificationReads notificationId=${notificationId}`
    )));

    logger.info('Deleted related notification documents', { reportId, count: snapshot.size });
    snapshot = await db.collection('Notifications').where('reportId', '==', reportId).limit(400).get();
  }
}

async function cleanupReportFirestoreData(reportId) {
  if (!reportId) return;

  await Promise.all([
    ...REPORT_SUBCOLLECTIONS.map((collectionName) => deleteQuerySnapshotInBatches(
      db.collection('Reports').doc(reportId).collection(collectionName),
      `Reports/${reportId}/${collectionName}`
    )),
    cleanupReportNotifications(reportId),
  ]);
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
  const title = cleanText(report.title || `${report.severity || 'Live'} ${report.hazardType || report.hazard_type || 'Hazard'}`, 'Community report', 120);
  const body = cleanText(report.description, 'A new community hazard report was submitted.', 240);

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
    barangay: cleanText(report.barangay, '', 80),
    reporterName: cleanText(report.reporterName, 'Resident', 80),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});

exports.onReportLikeCreated = onDocumentCreated('Reports/{reportId}/likes/{userId}', async (event) => {
  await updateReportCounter(event.params.reportId, 'likeCount', 1);
});

exports.onReportLikeDeleted = onDocumentDeleted('Reports/{reportId}/likes/{userId}', async (event) => {
  await updateReportCounter(event.params.reportId, 'likeCount', -1);
});

exports.onReportCommentCreated = onDocumentCreated('Reports/{reportId}/comments/{commentId}', async (event) => {
  await updateReportCounter(event.params.reportId, 'commentCount', 1);
});

exports.onReportCommentDeleted = onDocumentDeleted('Reports/{reportId}/comments/{commentId}', async (event) => {
  await updateReportCounter(event.params.reportId, 'commentCount', -1);
});

exports.onReportViewCreated = onDocumentCreated('Reports/{reportId}/userViews/{userId}', async (event) => {
  await updateReportCounter(event.params.reportId, 'viewCount', 1);
});

exports.onUserReportCreated = onDocumentCreated('Reports/{reportId}/userReports/{userId}', async (event) => {
  const userReport = event.data && event.data.data();
  if (!userReport) return;

  const reportRef = db.collection('Reports').doc(event.params.reportId);
  const moderationLogRef = db.collection('ModerationLogs').doc();

  await db.runTransaction(async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    if (!reportSnapshot.exists) return;

    const reportData = reportSnapshot.data();
    const category = MODERATION_CATEGORIES.includes(userReport.category) ? userReport.category : 'other';
    const categoryCounts = {
      ...(reportData.reportCategoryCounts || {}),
      [category]: (reportData.reportCategoryCounts?.[category] || 0) + 1,
    };
    const nextReportCount = (reportData.userReportCount || 0) + 1;
    const dominantCategory = getDominantCategory(categoryCounts);
    const shouldRemove = nextReportCount >= AUTO_TAKEDOWN_FLAG_THRESHOLD;

    transaction.update(reportRef, {
      userReportCount: nextReportCount,
      reportCategoryCounts: categoryCounts,
      moderationStatus: shouldRemove ? 'removed' : reportData.moderationStatus || 'visible',
      status: shouldRemove ? 'rejected' : reportData.status || 'active',
      removedReason: shouldRemove ? dominantCategory : reportData.removedReason || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (shouldRemove && reportData.moderationStatus !== 'removed' && reportData.status !== 'rejected') {
      transaction.set(moderationLogRef, {
        reportId: event.params.reportId,
        reporterId: reportData.userId || null,
        reportCount: nextReportCount,
        threshold: AUTO_TAKEDOWN_FLAG_THRESHOLD,
        dominantCategory,
        categoryCounts,
        action: 'auto_removed',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }).catch((error) => {
    logger.warn('Unable to process community moderation report', {
      reportId: event.params.reportId,
      error: error.message,
    });
  });
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
    title: 'ADMIN/OFFICIAL: Report removed',
    body: `Your report was taken down after 5 different users reported it. Reason: ${categoryLabel(dominantCategory)}.`,
    hazardType: after.hazardType || after.hazard_type || 'Hazard',
    severity: after.severity || 'Moderate',
    source: 'admin',
    sourceLabel: 'ADMIN/OFFICIAL',
    priority: 'high',
    moderationReason: dominantCategory,
    moderationReasonLabel: categoryLabel(dominantCategory),
    reportCategoryCounts: after.reportCategoryCounts || {},
    createdAt: FieldValue.serverTimestamp(),
  });
});

exports.onReportDeleted = onDocumentDeleted('Reports/{reportId}', async (event) => {
  const report = event.data && event.data.data();
  if (!report) return;

  await cleanupReportMedia(report).catch((error) => {
    logger.warn('Unable to clean Cloudinary media for deleted report', error);
  });

  await cleanupReportFirestoreData(event.params.reportId).catch((error) => {
    logger.warn('Unable to clean Firestore data for deleted report', {
      reportId: event.params.reportId,
      error: error.message,
    });
  });
});
