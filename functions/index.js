const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function categoryLabel(category) {
  return String(category || 'other').replace(/_/g, ' ');
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

  const users = await db.collection('Users').select().get();
  const writes = users.docs.map((userDoc) => ({
    ref: db.collection('Notifications').doc(),
    data: {
      audience: 'user',
      recipientId: userDoc.id,
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
    },
  }));

  for (const group of chunk(writes, 450)) {
    const batch = db.batch();
    group.forEach((write) => batch.set(write.ref, write.data));
    await batch.commit();
  }
});

exports.onReportRemoved = onDocumentUpdated('Reports/{reportId}', async (event) => {
  const before = event.data && event.data.before.data();
  const after = event.data && event.data.after.data();
  if (!before || !after) return;

  const wasRemoved = before.moderationStatus === 'removed' || before.status === 'rejected';
  const isRemoved = after.moderationStatus === 'removed' || after.status === 'rejected';

  if (wasRemoved || !isRemoved || !after.userId) return;

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
