const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');

// Get all notifications grouped by date
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('Notifications')
      .orderBy('timestamp', 'desc')
      .get();

    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Group by date
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

// Create notification and send to all users
router.post('/', async (req, res) => {
  try {
    const { title, description, type, level } = req.body;

    const notification = {
      title,
      description,
      type,    // 'water_level', 'flood', 'storm', 'heat'
      level,   // 'normal', 'warning', 'critical'
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    };

    // Save to Firestore
    const docRef = await db.collection('Notifications').add(notification);

    // Get all user FCM tokens
    const usersSnapshot = await db.collection('Users')
      .where('fcm_token', '!=', null)
      .get();

    const tokens = usersSnapshot.docs
      .map(doc => doc.data().fcm_token)
      .filter(Boolean);

    // Send push notification if there are tokens
    if (tokens.length > 0) {
      const message = {
        notification: {
          title,
          body: description,
        },
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Sent ${response.successCount} notifications`);
    }

    res.status(201).json({
      message: 'Notification created and sent',
      id: docRef.id,
      recipients: tokens.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    await db.collection('Notifications').doc(req.params.id)
      .update({ read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;