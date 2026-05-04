const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');

router.post('/', async (req, res) => {
  try {
    const {
      sender_id, hazard_type,
      latitude, longitude,
      description, image_url, status
    } = req.body;

    const report = {
      sender_id,
      hazard_type,
      location: new admin.firestore.GeoPoint(latitude, longitude),
      description,
      image_url,
      status: status || 'pending',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('Reports').add(report);
    res.status(201).json({ id: docRef.id, ...report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('Reports')
      .orderBy('timestamp', 'desc')
      .get();

    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;