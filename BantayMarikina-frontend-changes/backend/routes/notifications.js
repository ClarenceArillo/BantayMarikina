const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');

// Simple admin check — swap this out for whatever auth middleware you have
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  console.log('Received key:', adminKey);
  console.log('Expected key:', process.env.ADMIN_SECRET_KEY);
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function validateNotificationBody(req, res, next) {
  const { title, description, type, level } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  const validTypes = ['water_level', 'flood', 'storm', 'heat'];
  const validLevels = ['normal', 'warning', 'critical'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }
  if (level && !validLevels.includes(level)) {
    return res.status(400).json({ error: `level must be one of: ${validLevels.join(', ')}` });
  }
  next();
}

// Chunk array into batches of a given size
function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Get all notifications grouped by date (auth-protected)
router.get('/', async (req, res) => {
  try {
    // TODO: add user auth middleware and filter to that user's notifications
    const snapshot = await db.collection('Notifications')
      .orderBy('timestamp', 'desc')
      .get();

    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const grouped = {};
    notifications.forEach(notif => {
      const date = new Date(notif.timestamp?.toDate?.() || notif.timestamp)
        .toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(notif);
    });

    const result = Object.entries(grouped).map(([date, items]) => ({
      date,
      notifications: items,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single notification
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('Notifications').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create notification and send to all users (admin only)
router.post('/', requireAdmin, validateNotificationBody, async (req, res) => {
  try {
    const { title, description, type, level } = req.body;

    const notification = {
      title: title.trim(),
      description: description.trim(),
      type: type || null,
      level: level || 'normal',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('Notifications').add(notification);

    // Fetch tokens from a dedicated collection or field
    const usersSnapshot = await db.collection('Users')
      .where('fcm_token', '!=', '')
      .get();

    const tokensByUserId = {};
    usersSnapshot.docs.forEach(doc => {
      const token = doc.data().fcm_token;
      if (token) tokensByUserId[doc.id] = token;
    });

    const tokens = Object.values(tokensByUserId);
    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      const batches = chunk(tokens, 500);

      for (const batch of batches) {
        const response = await admin.messaging().sendEachForMulticast({
          notification: { title: title.trim(), body: description.trim() },
          tokens: batch,
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        // Remove tokens that are no longer valid
        const invalidTokens = [];
        response.responses.forEach((result, index) => {
          if (!result.success) {
            const code = result.error?.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(batch[index]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          const cleanupBatch = db.batch();
          usersSnapshot.docs.forEach(doc => {
            if (invalidTokens.includes(doc.data().fcm_token)) {
              cleanupBatch.update(doc.ref, { fcm_token: admin.firestore.FieldValue.delete() });
            }
          });
          await cleanupBatch.commit();
        }
      }
    }

    res.status(201).json({
      message: 'Notification created and sent',
      id: docRef.id,
      recipients: tokens.length,
      successCount,
      failureCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read (per-user read state is a TODO — this is global for now)
router.patch('/:id/read', async (req, res) => {
  try {
    const doc = await db.collection('Notifications').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    await doc.ref.update({ read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;