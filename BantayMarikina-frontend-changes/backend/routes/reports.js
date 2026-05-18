const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');

// Submit a new hazard report
router.post('/', async (req, res) => {
  try {
    const {
      sender_id, hazard_type,
      latitude, longitude,
      description, image_url, status,
      barangay
    } = req.body;

    const report = {
      sender_id,
      hazard_type,
      location: new admin.firestore.GeoPoint(latitude, longitude),
      barangay: barangay || '',
      description,
      image_url,
      status: status || 'pending',
      likes: 0,
      comments: 0,
      flagged: 0,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('Reports').add(report);
    res.status(201).json({ id: docRef.id, ...report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all verified reports with user info (for map)
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('Reports')
      .where('status', '==', 'verified')
      .orderBy('timestamp', 'desc')
      .get();

    // Get user info for each report
    const reports = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();

      // Get user profile
      let user = null;
      if (data.sender_id) {
        const userDoc = await db.collection('Users').doc(data.sender_id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          user = {
            full_name: `${userData.first_name} ${userData.last_name}`,
            username: userData.username,
            profile_image: userData.profile_image || null,
          };
        }
      }

      // Calculate time ago
      const timestamp = data.timestamp?.toDate?.() || new Date();
      const diffMs = Date.now() - timestamp.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const timeAgo = diffHrs > 0 ? `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago` : `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

      return {
        id: doc.id,
        sender_id: data.sender_id,
        user,
        hazard_type: data.hazard_type,
        barangay: data.barangay,
        description: data.description,
        image_url: data.image_url,
        status: data.status,
        likes: data.likes || 0,
        comments: data.comments || 0,
        flagged: data.flagged || 0,
        time_ago: timeAgo,
        latitude: data.location?._latitude || null,
        longitude: data.location?._longitude || null,
        timestamp: data.timestamp,
      };
    }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single report by ID
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('Reports').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const data = doc.data();

    // Get user profile
    let user = null;
    if (data.sender_id) {
      const userDoc = await db.collection('Users').doc(data.sender_id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        user = {
          full_name: `${userData.first_name} ${userData.last_name}`,
          username: userData.username,
          profile_image: userData.profile_image || null,
        };
      }
    }

    res.json({ id: doc.id, user, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like a report
router.post('/:id/like', async (req, res) => {
  try {
    const ref = db.collection('Reports').doc(req.params.id);
    await ref.update({
      likes: admin.firestore.FieldValue.increment(1),
    });
    res.json({ message: 'Report liked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Flag a report
router.post('/:id/flag', async (req, res) => {
  try {
    const ref = db.collection('Reports').doc(req.params.id);
    await ref.update({
      flagged: admin.firestore.FieldValue.increment(1),
    });
    res.json({ message: 'Report flagged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { sender_id, text } = req.body;

    // Get user info
    const userDoc = await db.collection('Users').doc(sender_id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userData = userDoc.data();

    const comment = {
      sender_id,
      text,
      full_name: `${userData.first_name} ${userData.last_name}`,
      username: userData.username,
      profile_image: userData.profile_image || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save comment to subcollection
    await db.collection('Reports').doc(req.params.id)
      .collection('Comments').add(comment);

    // Increment comment count
    await db.collection('Reports').doc(req.params.id)
      .update({ comments: admin.firestore.FieldValue.increment(1) });

    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all comments for a report
router.get('/:id/comments', async (req, res) => {
  try {
    const snapshot = await db.collection('Reports').doc(req.params.id)
      .collection('Comments')
      .orderBy('timestamp', 'desc')
      .get();

    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;