const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');
const axios = require('axios');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim();
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
    },
  };
}

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

router.patch('/me', requireAuthenticatedUser, async (req, res) => {
  try {
    const {
      first_name, middle_name, last_name, suffix,
      gender, contact_number, email,
      barangay, street_block, house_number,
    } = req.body;

    const cleanEmail = normalizeEmail(email);
    const cleanFirstName = String(first_name || '').trim();
    const cleanMiddleName = String(middle_name || '').trim();
    const cleanLastName = String(last_name || '').trim();
    const cleanSuffix = String(suffix || '').trim();
    const fullName = [cleanFirstName, cleanMiddleName, cleanLastName, cleanSuffix]
      .filter(Boolean)
      .join(' ');

    if (!cleanFirstName || !cleanLastName || !cleanEmail) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
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
      gender: String(gender || '').trim(),
      contact_number: String(contact_number || '').trim(),
      email: cleanEmail,
      email_lower: cleanEmail,
      barangay: String(barangay || '').trim(),
      street_block: String(street_block || '').trim(),
      house_number: String(house_number || '').trim(),
      name: {
        first: cleanFirstName,
        middle: cleanMiddleName,
        last: cleanLastName,
        suffix: cleanSuffix,
        full: fullName,
      },
      address: {
        barangay: String(barangay || '').trim(),
        street_block: String(street_block || '').trim(),
        house_number: String(house_number || '').trim(),
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

// Register
router.post('/register', async (req, res) => {
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
    const fullName = [first_name, middle_name, last_name, suffix]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');

    if (!first_name || !last_name || !cleanEmail || !cleanUsername || !password || !confirm_password) {
      return res.status(400).json({ error: 'Please complete all required fields' });
    }

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
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
        first_name: String(first_name || '').trim(),
        middle_name: String(middle_name || '').trim(),
        last_name: String(last_name || '').trim(),
        suffix: String(suffix || '').trim(),
        gender: String(gender || '').trim(),
        contact_number: String(contact_number || '').trim(),
        email: cleanEmail,
        email_lower: cleanEmail,
        barangay: String(barangay || '').trim(),
        street_block: String(street_block || '').trim(),
        house_number: String(house_number || '').trim(),
        username: cleanUsername,
        username_lower: usernameLower,
        name: {
          first: String(first_name || '').trim(),
          middle: String(middle_name || '').trim(),
          last: String(last_name || '').trim(),
          suffix: String(suffix || '').trim(),
          full: fullName,
        },
        address: {
          barangay: String(barangay || '').trim(),
          street_block: String(street_block || '').trim(),
          house_number: String(house_number || '').trim(),
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
router.post('/login', async (req, res) => {
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

    const authResponse = await axios.post(
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
      },
    });
  } catch (error) {
    logAuthError('Login', error);
    const status = error.response?.status === 400 ? 401 : 500;
    res.status(status).json({ error: getAuthErrorMessage(error) });
  }
});

// Send Firebase Auth password reset email
router.post('/forgot-password', async (req, res) => {
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

    await axios.post(
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

router.post('/firebase-token', requireAuthenticatedUser, async (req, res) => {
  try {
    const customToken = await admin.auth().createCustomToken(req.auth.uid);
    res.json({ customToken });
  } catch (error) {
    res.status(500).json({ error: 'Unable to create Firebase session token' });
  }
});

module.exports = router;
