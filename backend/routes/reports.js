const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');

const MARIKINA_BOUNDS = {
  minLat: 14.57,
  maxLat: 14.72,
  minLng: 121.03,
  maxLng: 121.18,
};

function normalizeHazardType(type) {
  const allowedTypes = new Set([
    'Flood',
    'Fire',
    'Landslide',
    'Earthquake Damage',
    'Road Blockage',
    'Power Outage',
    'Others',
  ]);
  const cleanType = String(type || '').trim();

  return allowedTypes.has(cleanType) ? cleanType : 'Others';
}

function validateCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= MARIKINA_BOUNDS.minLat &&
    latitude <= MARIKINA_BOUNDS.maxLat &&
    longitude >= MARIKINA_BOUNDS.minLng &&
    longitude <= MARIKINA_BOUNDS.maxLng
  );
}

router.post('/', async (req, res) => {
  try {
    const {
      sender_id, userId, hazard_type, hazardType,
      latitude, longitude, accuracyMeters,
      description, image_url, imageUrl, status,
      severity, barangay, reporterName
    } = req.body;
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const cleanDescription = String(description || '').trim();

    if (!cleanDescription || cleanDescription.length < 8) {
      return res.status(400).json({ error: 'Description must be at least 8 characters' });
    }

    if (!validateCoordinates(parsedLatitude, parsedLongitude)) {
      return res.status(400).json({ error: 'Reports are currently limited to Marikina City' });
    }

    const cleanHazardType = normalizeHazardType(hazardType || hazard_type);
    const cleanStatus = status || 'active';
    const cleanImageUrl = imageUrl || image_url || null;
    const cleanUserId = userId || sender_id || null;

    const report = {
      sender_id: cleanUserId,
      userId: cleanUserId,
      hazard_type: cleanHazardType,
      hazardType: cleanHazardType,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      location: new admin.firestore.GeoPoint(parsedLatitude, parsedLongitude),
      accuracyMeters: Number.isFinite(Number(accuracyMeters)) ? Number(accuracyMeters) : null,
      description: cleanDescription,
      image_url: cleanImageUrl,
      imageUrl: cleanImageUrl,
      status: cleanStatus,
      severity: String(severity || 'Moderate').trim(),
      barangay: String(barangay || '').trim(),
      reporterName: String(reporterName || '').trim(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
