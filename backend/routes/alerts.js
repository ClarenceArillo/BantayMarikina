const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { createOfficialHazardAlert } = require('../services/officialAlerts');

async function requireAuthenticatedUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: 'Authentication token is required' });
    }

    req.auth = await admin.auth().verifyIdToken(match[1]);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

async function requireOfficialAccess(req, res, next) {
  const apiKey = process.env.OFFICIAL_ALERT_API_KEY;
  const providedKey = req.headers['x-official-alert-key'];

  if (apiKey && providedKey && providedKey === apiKey) {
    req.officialSource = { uid: 'api-trigger', role: 'api' };
    return next();
  }

  return requireAuthenticatedUser(req, res, async () => {
    const userDoc = await db.collection('Users').doc(req.auth.uid).get();
    const role = userDoc.data()?.role || 'resident';

    if (!['admin', 'official', 'responder'].includes(role)) {
      return res.status(403).json({ error: 'Official alert access is required' });
    }

    req.officialSource = { uid: req.auth.uid, role };
    return next();
  });
}

router.post('/official', requireOfficialAccess, async (req, res) => {
  try {
    const alert = await createOfficialHazardAlert({
      ...req.body,
      createdBy: req.officialSource.uid,
      createdByRole: req.officialSource.role,
    });

    return res.status(201).json({ alert });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
