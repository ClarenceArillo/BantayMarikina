const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const https = require('https');
const { admin, db } = require('../firebase');
const { createRateLimiter } = require('../middleware/security');

const router = express.Router();

const ALLOWED_FOLDERS = new Set(['reports/images', 'reports/videos', 'profiles']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]);
const cloudinaryHttp = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
  timeout: 20_000,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cloudinaryPost(url, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await cloudinaryHttp.post(url, body);
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (![408, 429, 500, 502, 503, 504].includes(status) || attempt === 2) break;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

function parseCloudinaryUrl() {
  const value = process.env.CLOUDINARY_URL;
  if (!value) {
    return {
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }

  try {
    const parsed = new URL(value);
    return {
      apiKey: parsed.username,
      apiSecret: parsed.password,
      cloudName: parsed.hostname,
    };
  } catch {
    return null;
  }
}

function getCloudinaryConfig() {
  const config = parseCloudinaryUrl();
  if (!config?.apiKey || !config?.cloudName) {
    throw new Error('Cloudinary cloud name and API key are not configured on the backend.');
  }
  if (!config?.apiSecret || config.apiSecret === 'your_cloudinary_api_secret') {
    throw new Error('Cloudinary API secret is not configured on the backend. Upload signatures require CLOUDINARY_API_SECRET or CLOUDINARY_URL.');
  }
  return config;
}

function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

async function requireAuthenticatedUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: 'Authentication token is required' });
    }

    req.auth = await admin.auth().verifyIdToken(match[1]);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

function validateFolder(folder) {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error('Unsupported media folder.');
  }
}

function validateUploadRequest({ bytes, folder, resourceType }) {
  validateFolder(folder);

  const size = Number(bytes || 0);
  const maxBytes = resourceType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
    throw new Error(resourceType === 'video'
      ? 'Videos must be 80MB or smaller.'
      : 'Images must be 8MB or smaller.');
  }

  if (folder === 'reports/videos' && resourceType !== 'video') {
    throw new Error('Video uploads must use the reports/videos folder.');
  }

  if ((folder === 'reports/images' || folder === 'profiles') && resourceType !== 'image') {
    throw new Error('This folder only accepts images.');
  }
}

function validateMimeType(mimeType, resourceType) {
  if (!mimeType) return;
  if (!ALLOWED_MIME_TYPES.has(String(mimeType).toLowerCase())) {
    throw new Error('Unsupported media type.');
  }
  if (resourceType === 'image' && !String(mimeType).startsWith('image/')) {
    throw new Error('This upload only accepts images.');
  }
  if (resourceType === 'video' && !String(mimeType).startsWith('video/')) {
    throw new Error('This upload only accepts videos.');
  }
}

function ownsCloudinaryAsset(publicId, uid) {
  return [...ALLOWED_FOLDERS].some((folder) => publicId.startsWith(`${folder}/${uid}/`));
}

function isCloudinaryUrl(value, cloudName) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.startsWith(`/${cloudName}/`);
  } catch {
    return false;
  }
}

router.get('/cloudinary/status', requireAuthenticatedUser, (req, res) => {
  const config = parseCloudinaryUrl();

  return res.json({
    connected: Boolean(config?.apiKey && config?.apiSecret && config.apiSecret !== 'your_cloudinary_api_secret' && config?.cloudName),
    cloudName: config?.cloudName || null,
    hasApiKey: Boolean(config?.apiKey),
    hasApiSecret: Boolean(config?.apiSecret && config.apiSecret !== 'your_cloudinary_api_secret'),
    uploadFolders: [...ALLOWED_FOLDERS],
  });
});

router.post('/cloudinary/sign-upload', requireAuthenticatedUser, createRateLimiter({
  keyPrefix: 'cloudinary-sign',
  limit: 20,
  windowMs: 60_000,
}), async (req, res) => {
  try {
    const { apiKey, apiSecret, cloudName } = getCloudinaryConfig();
    const folder = String(req.body.folder || '');
    const resourceType = String(req.body.resourceType || 'image');

    validateUploadRequest({
      bytes: req.body.bytes,
      folder,
      resourceType,
    });
    validateMimeType(req.body.mimeType, resourceType);

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(8).toString('hex');
    const publicId = `${req.auth.uid}/${timestamp}-${nonce}`;
    const tags = ['bantay-marikina', req.auth.uid].join(',');
    const context = `user_id=${req.auth.uid}`;
    const paramsToSign = {
      context,
      folder,
      overwrite: false,
      public_id: publicId,
      timestamp,
      tags,
    };

    return res.json({
      apiKey,
      cloudName,
      context,
      folder,
      maxBytes: resourceType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
      publicId,
      resourceType,
      signature: signParams(paramsToSign, apiSecret),
      tags,
      timestamp,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    });
  } catch (error) {
    const isConfigError = /configured/i.test(error.message || '');
    return res.status(isConfigError ? 503 : 400).json({ error: isConfigError ? 'Media uploads are temporarily unavailable.' : error.message || 'Unable to prepare upload.' });
  }
});

router.post('/cloudinary/delete', requireAuthenticatedUser, createRateLimiter({
  keyPrefix: 'cloudinary-delete',
  limit: 30,
  windowMs: 60_000,
}), async (req, res) => {
  try {
    const { apiKey, apiSecret, cloudName } = getCloudinaryConfig();
    const publicId = String(req.body.publicId || '');
    const resourceType = String(req.body.resourceType || 'image');

    if (!publicId || !ownsCloudinaryAsset(publicId, req.auth.uid)) {
      return res.status(400).json({ error: 'Unsupported media asset.' });
    }

    if (req.body.userId && req.body.userId !== req.auth.uid) {
      return res.status(403).json({ error: 'You can only delete your own media.' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({ public_id: publicId, timestamp }, apiSecret);

    await cloudinaryPost(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, new URLSearchParams({
      api_key: apiKey,
      public_id: publicId,
      signature,
      timestamp: String(timestamp),
    }));

    return res.json({ deleted: true });
  } catch (error) {
    return res.status(500).json({ error: error.response?.data?.error?.message || 'Unable to delete media.' });
  }
});

router.post('/cloudinary/profile-photo', requireAuthenticatedUser, createRateLimiter({
  keyPrefix: 'profile-photo',
  limit: 12,
  windowMs: 60_000,
}), async (req, res) => {
  try {
    const { cloudName } = getCloudinaryConfig();
    const { media } = req.body;
    if (!media?.secure_url || !media?.public_id) {
      return res.status(400).json({ error: 'Cloudinary media metadata is required.' });
    }
    if (!ownsCloudinaryAsset(String(media.public_id), req.auth.uid) || !String(media.public_id).startsWith(`profiles/${req.auth.uid}/`)) {
      return res.status(403).json({ error: 'You can only attach your own profile media.' });
    }
    if (!isCloudinaryUrl(media.secure_url, cloudName)) {
      return res.status(400).json({ error: 'Unsupported profile media URL.' });
    }

    const userRef = db.collection('Users').doc(req.auth.uid);
    const userDoc = await userRef.get();
    const previous = userDoc.data()?.profilePhotoMedia;

    await userRef.update({
      photoURL: media.secure_url,
      profilePhotoUrl: media.secure_url,
      profile_photo_url: media.secure_url,
      profilePhotoMedia: media,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ photoUrl: media.secure_url, previousPublicId: previous?.public_id || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update profile photo.' });
  }
});

router.delete('/cloudinary/profile-photo', requireAuthenticatedUser, createRateLimiter({
  keyPrefix: 'profile-photo-delete',
  limit: 12,
  windowMs: 60_000,
}), async (req, res) => {
  try {
    const userRef = db.collection('Users').doc(req.auth.uid);
    const userDoc = await userRef.get();
    const previous = userDoc.data()?.profilePhotoMedia;

    await userRef.update({
      photoURL: '',
      profilePhotoUrl: '',
      profile_photo_url: '',
      profilePhotoMedia: admin.firestore.FieldValue.delete(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ removed: true, previousPublicId: previous?.public_id || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to remove profile photo.' });
  }
});

module.exports = router;
