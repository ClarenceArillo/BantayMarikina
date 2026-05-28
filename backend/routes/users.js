const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');
const axios = require('axios');
const https = require('https');
const { createRateLimiter, sanitizeText, validateEmail } = require('../middleware/security');

const firebaseAuthHttp = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
  timeout: 15_000,
});
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postFirebaseAuth(url, body) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await firebaseAuthHttp.post(url, body);
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (!RETRYABLE_STATUS.has(status) || attempt === 2) break;
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return sanitizeText(username, 24);
}

function normalizeUsernameKey(username) {
  return normalizeUsername(username).toLowerCase();
}

function getFirebaseApiKey() {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!apiKey || apiKey === 'your_firebase_web_api_key') {
    return null;
  }

  return apiKey;
}

function getAuthErrorMessage(error) {
  const firebaseMessage = error.response?.data?.error?.message;

  if (error.code === 'auth/email-already-exists') {
    return 'Email already registered';
  }

  if (error.code === 'auth/invalid-email') {
    return 'Please enter a valid email address';
  }

  if (error.code === 'auth/invalid-password') {
    return 'Password should be at least 6 characters';
  }

  if (
    firebaseMessage === 'EMAIL_NOT_FOUND' ||
    firebaseMessage === 'INVALID_PASSWORD' ||
    firebaseMessage === 'INVALID_LOGIN_CREDENTIALS'
  ) {
    return 'Invalid email or password';
  }

  if (firebaseMessage === 'EMAIL_EXISTS') {
    return 'Email already registered';
  }

  if (firebaseMessage === 'WEAK_PASSWORD : Password should be at least 6 characters') {
    return 'Password should be at least 6 characters';
  }

  return firebaseMessage || error.message || 'Authentication failed';
}

function getRegisterErrorStatus(error) {
  const badRequestCodes = new Set([
    'auth/email-already-exists',
    'auth/invalid-email',
    'auth/invalid-password',
  ]);

  return badRequestCodes.has(error.code) ? 400 : 500;
}

function logAuthError(action, error) {
  console.error(`${action} failed:`, {
    code: error.code,
    message: error.message,
    firebaseMessage: error.response?.data?.error?.message,
    status: error.response?.status,
  });
}

async function requireAuthenticatedUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: 'Authentication token is required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(match[1]);
    req.auth = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

function buildProfileResponse(uid, userData) {
  const fullName = userData.name?.full || [userData.first_name, userData.middle_name, userData.last_name, userData.suffix]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

  return {
    uid,
    username: userData.username || '',
    role: userData.role || 'resident',
    full_name: fullName,
    profile: {
      name: userData.name || {
        first: userData.first_name || '',
        middle: userData.middle_name || '',
        last: userData.last_name || '',
        suffix: userData.suffix || '',
        full: fullName,
      },
      address: userData.address || {
        barangay: userData.barangay || '',
        street_block: userData.street_block || '',
        house_number: userData.house_number || '',
      },
      barangay: userData.barangay || userData.address?.barangay || '',
      contact_number: userData.contact_number || '',
      email: userData.email || '',
      gender: userData.gender || '',
      photoURL: userData.photoURL || userData.profilePhotoUrl || userData.profile_photo_url || '',
      profilePhotoUrl: userData.profilePhotoUrl || userData.photoURL || userData.profile_photo_url || '',
      profile_photo_url: userData.profile_photo_url || userData.profilePhotoUrl || userData.photoURL || '',
    },
  };
}

const authAttemptLimiter = createRateLimiter({
  keyPrefix: 'auth-attempt',
  limit: 12,
  windowMs: 15 * 60_000,
  message: 'Too many authentication attempts. Please wait before trying again.',
});

const profileUpdateLimiter = createRateLimiter({
  keyPrefix: 'profile-update',
  limit: 30,
  windowMs: 60_000,
});

async function findUserByUsername(username) {
  const usernameLower = normalizeUsernameKey(username);

  if (!usernameLower) {
    return null;
  }

  let snapshot = await db.collection('Users')
    .where('username_lower', '==', usernameLower)
    .limit(1)
    .get();

  if (snapshot.empty) {
    snapshot = await db.collection('Users')
      .where('username', '==', normalizeUsername(username))
      .limit(1)
      .get();
  }

  return snapshot.empty ? null : snapshot.docs[0];
}

async function resolveLoginEmail(identifier) {
  const cleanIdentifier = String(identifier || '').trim();

  if (!cleanIdentifier) {
    return null;
  }

  if (cleanIdentifier.includes('@')) {
    return normalizeEmail(cleanIdentifier);
  }

  const userDoc = await findUserByUsername(cleanIdentifier);
  return userDoc?.data().email || null;
}

router.get('/me', requireAuthenticatedUser, async (req, res) => {
  try {
    const userDoc = await db.collection('Users').doc(req.auth.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.json(buildProfileResponse(req.auth.uid, userDoc.data()));
  } catch (error) {
    logAuthError('Get profile', error);
    return res.status(500).json({ error: 'Unable to load profile' });
  }
});

router.post('/firebase-token', requireAuthenticatedUser, async (req, res) => {
  try {
    console.log(JSON.stringify({
      level: 'info',
      message: 'Issuing Firebase custom token',
      route: '/api/users/firebase-token',
      uid: req.auth.uid,
      role: req.auth.role || 'resident',
      authTime: req.auth.auth_time || null,
      tokenIssuedAt: req.auth.iat || null,
      tokenExpiresAt: req.auth.exp || null,
      forwardedFor: req.headers['x-forwarded-for'] || null,
      origin: req.headers.origin || null,
      timestamp: new Date().toISOString(),
    }));
    const customToken = await admin.auth().createCustomToken(req.auth.uid, {
      role: req.auth.role || 'resident',
    });

    return res.json({ customToken });
  } catch (error) {
    logAuthError('Create Firebase custom token', error);
    return res.status(500).json({ error: 'Unable to create Firebase session' });
  }
});

router.patch('/me', requireAuthenticatedUser, profileUpdateLimiter, async (req, res) => {
  try {
    const {
      first_name, middle_name, last_name, suffix,
      gender, contact_number, email,
      barangay, street_block, house_number,
    } = req.body;

    const cleanEmail = normalizeEmail(email);
    const cleanFirstName = sanitizeText(first_name, 60);
    const cleanMiddleName = sanitizeText(middle_name, 60);
    const cleanLastName = sanitizeText(last_name, 60);
    const cleanSuffix = sanitizeText(suffix, 20);
    const fullName = [cleanFirstName, cleanMiddleName, cleanLastName, cleanSuffix]
      .filter(Boolean)
      .join(' ');

    if (!cleanFirstName || !cleanLastName || !cleanEmail) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }
    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const userRef = db.collection('Users').doc(req.auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    await userRef.update({
      first_name: cleanFirstName,
      middle_name: cleanMiddleName,
      last_name: cleanLastName,
      suffix: cleanSuffix,
      gender: sanitizeText(gender, 40),
      contact_number: sanitizeText(contact_number, 32),
      email: cleanEmail,
      email_lower: cleanEmail,
      barangay: sanitizeText(barangay, 80),
      street_block: sanitizeText(street_block, 120),
      house_number: sanitizeText(house_number, 40),
      name: {
        first: cleanFirstName,
        middle: cleanMiddleName,
        last: cleanLastName,
        suffix: cleanSuffix,
        full: fullName,
      },
      address: {
        barangay: sanitizeText(barangay, 80),
        street_block: sanitizeText(street_block, 120),
        house_number: sanitizeText(house_number, 40),
      },
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updatedDoc = await userRef.get();
    return res.json(buildProfileResponse(req.auth.uid, updatedDoc.data()));
  } catch (error) {
    logAuthError('Update profile', error);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

router.patch('/me/username', requireAuthenticatedUser, profileUpdateLimiter, async (req, res) => {
  try {
    const cleanUsername = normalizeUsername(req.body.username);
    const usernameLower = normalizeUsernameKey(cleanUsername);

    if (!/^[a-zA-Z0-9._-]{3,24}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, dots, dashes, or underscores.' });
    }

    const existing = await db.collection('Users')
      .where('username_lower', '==', usernameLower)
      .limit(1)
      .get();

    if (!existing.empty && existing.docs[0].id !== req.auth.uid) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const userRef = db.collection('Users').doc(req.auth.uid);
    await userRef.update({
      username: cleanUsername,
      username_lower: usernameLower,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userDoc = await userRef.get();
    return res.json(buildProfileResponse(req.auth.uid, userDoc.data()));
  } catch (error) {
    logAuthError('Update username', error);
    return res.status(500).json({ error: 'Unable to update username' });
  }
});

router.patch('/me/password', requireAuthenticatedUser, authAttemptLimiter, async (req, res) => {
  try {
    const currentPassword = String(req.body.current_password || '');
    const newPassword = String(req.body.new_password || '');
    const confirmPassword = String(req.body.confirm_password || '');
    const user = await admin.auth().getUser(req.auth.uid);
    const firebaseApiKey = getFirebaseApiKey();

    if (!firebaseApiKey) {
      return res.status(500).json({ error: 'FIREBASE_WEB_API_KEY is required for password changes' });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Current password, new password, and confirmation are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Use at least 8 characters with uppercase, lowercase, and a number.' });
    }

    await postFirebaseAuth(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        email: user.email,
        password: currentPassword,
        returnSecureToken: true,
      }
    );

    await admin.auth().updateUser(req.auth.uid, { password: newPassword });
    await db.collection('Users').doc(req.auth.uid).update({
      password_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logAuthError('Update password', error);
    const firebaseMessage = error.response?.data?.error?.message;
    if (firebaseMessage === 'INVALID_PASSWORD' || firebaseMessage === 'INVALID_LOGIN_CREDENTIALS') {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    return res.status(500).json({ error: getAuthErrorMessage(error) || 'Unable to update password' });
  }
});

// Register
router.post('/register', authAttemptLimiter, async (req, res) => {
  try {
    const {
      first_name, middle_name, last_name, suffix,
      gender, contact_number, email,
      barangay, street_block, house_number,
      username, password, confirm_password
    } = req.body;

    const cleanEmail = normalizeEmail(email);
    const cleanUsername = normalizeUsername(username);
    const usernameLower = normalizeUsernameKey(cleanUsername);
    const cleanFirstName = sanitizeText(first_name, 60);
    const cleanMiddleName = sanitizeText(middle_name, 60);
    const cleanLastName = sanitizeText(last_name, 60);
    const cleanSuffix = sanitizeText(suffix, 20);
    const fullName = [cleanFirstName, cleanMiddleName, cleanLastName, cleanSuffix]
      .filter(Boolean)
      .join(' ');

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !cleanUsername || !password || !confirm_password) {
      return res.status(400).json({ error: 'Please complete all required fields' });
    }
    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (!/^[a-zA-Z0-9._-]{3,24}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, dots, dashes, or underscores.' });
    }

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Use at least 8 characters with uppercase, lowercase, and a number.' });
    }

    // Check if username already exists
    const usernameCheck = await db.collection('Users')
      .where('username_lower', '==', usernameLower)
      .get();

    if (!usernameCheck.empty) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password,
      displayName: fullName,
    });

    try {
      // Save profile data only. Passwords stay in Firebase Auth.
      await db.collection('Users').doc(userRecord.uid).set({
        first_name: cleanFirstName,
        middle_name: cleanMiddleName,
        last_name: cleanLastName,
        suffix: cleanSuffix,
        gender: sanitizeText(gender, 40),
        contact_number: sanitizeText(contact_number, 32),
        email: cleanEmail,
        email_lower: cleanEmail,
        barangay: sanitizeText(barangay, 80),
        street_block: sanitizeText(street_block, 120),
        house_number: sanitizeText(house_number, 40),
        username: cleanUsername,
        username_lower: usernameLower,
        name: {
          first: cleanFirstName,
          middle: cleanMiddleName,
          last: cleanLastName,
          suffix: cleanSuffix,
          full: fullName,
        },
        address: {
          barangay: sanitizeText(barangay, 80),
          street_block: sanitizeText(street_block, 120),
          house_number: sanitizeText(house_number, 40),
        },
        role: 'resident',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (profileError) {
      await admin.auth().deleteUser(userRecord.uid).catch(() => undefined);
      throw profileError;
    }

    res.status(201).json({
      message: 'Account created successfully',
      uid: userRecord.uid,
      username: cleanUsername,
      email: cleanEmail,
    });
  } catch (error) {
    logAuthError('Register', error);
    const status = getRegisterErrorStatus(error);
    res.status(status).json({ error: getAuthErrorMessage(error) });
  }
});

// Login with email/username + password
router.post('/login', authAttemptLimiter, async (req, res) => {
  try {
    const { email, identifier, username, password } = req.body;
    const loginIdentifier = identifier || email || username;
    const cleanEmail = await resolveLoginEmail(loginIdentifier);
    const firebaseApiKey = getFirebaseApiKey();

    if (!firebaseApiKey) {
      return res.status(500).json({
        error: 'FIREBASE_WEB_API_KEY is required for password login',
      });
    }

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email or username and password are required' });
    }

    const authResponse = await postFirebaseAuth(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        email: cleanEmail,
        password,
        returnSecureToken: true,
      }
    );

    const { localId, idToken, refreshToken, expiresIn } = authResponse.data;

    let userDoc = await db.collection('Users').doc(localId).get();

    if (!userDoc.exists) {
      const snapshot = await db.collection('Users')
        .where('email', '==', cleanEmail)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      userDoc = snapshot.docs[0];
    }

    const userData = userDoc.data();
    const fullName = userData.name?.full || `${userData.first_name || ''} ${userData.last_name || ''}`.trim();

    res.json({
      message: 'Login successful',
      uid: localId || userDoc.id,
      idToken,
      refreshToken,
      expiresIn,
      username: userData.username,
      role: userData.role,
      barangay: userData.barangay,
      full_name: fullName,
      profile: {
        name: userData.name || {
          first: userData.first_name,
          middle: userData.middle_name,
          last: userData.last_name,
          suffix: userData.suffix,
          full: fullName,
        },
        address: userData.address || {
          barangay: userData.barangay,
          street_block: userData.street_block,
          house_number: userData.house_number,
        },
        contact_number: userData.contact_number,
        email: userData.email,
        gender: userData.gender,
        photoURL: userData.photoURL || userData.profilePhotoUrl || userData.profile_photo_url || '',
        profilePhotoUrl: userData.profilePhotoUrl || userData.photoURL || userData.profile_photo_url || '',
        profile_photo_url: userData.profile_photo_url || userData.profilePhotoUrl || userData.photoURL || '',
      },
    });
  } catch (error) {
    logAuthError('Login', error);
    const status = error.response?.status === 400 ? 401 : 500;
    res.status(status).json({ error: getAuthErrorMessage(error) });
  }
});

// Send Firebase Auth password reset email
router.post('/forgot-password', authAttemptLimiter, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.body.email);
    const firebaseApiKey = getFirebaseApiKey();

    if (!firebaseApiKey) {
      return res.status(500).json({
        error: 'FIREBASE_WEB_API_KEY is required for password reset',
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await postFirebaseAuth(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`,
      {
        requestType: 'PASSWORD_RESET',
        email: cleanEmail,
      }
    );

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    const status = error.response?.status === 400 ? 404 : 500;
    res.status(status).json({ error: getAuthErrorMessage(error) });
  }
});

module.exports = router;
