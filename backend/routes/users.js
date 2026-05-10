const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');
const axios = require('axios');

const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getAuthErrorMessage(error) {
  const firebaseMessage = error.response?.data?.error?.message;

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
    const cleanUsername = String(username || '').trim();

    if (!first_name || !last_name || !cleanEmail || !cleanUsername || !password || !confirm_password) {
      return res.status(400).json({ error: 'Please complete all required fields' });
    }

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if username already exists
    const usernameCheck = await db.collection('Users')
      .where('username', '==', cleanUsername)
      .get();

    if (!usernameCheck.empty) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password,
      displayName: `${first_name} ${last_name}`,
    });

    // Save full profile to Users collection
    await db.collection('Users').doc(userRecord.uid).set({
      first_name,
      middle_name,
      last_name,
      suffix,
      gender,
      contact_number,
      email: cleanEmail,
      barangay,
      street_block,
      house_number,
      username: cleanUsername,
      role: 'resident',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      message: 'Account created successfully',
      uid: userRecord.uid,
      username: cleanUsername,
      email: cleanEmail,
    });
  } catch (error) {
    const status = error.code === 'auth/email-already-exists' ? 400 : 500;
    res.status(status).json({ error: getAuthErrorMessage(error) });
  }
});

// Login with email + password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = normalizeEmail(email);

    if (!firebaseApiKey) {
      return res.status(500).json({
        error: 'FIREBASE_WEB_API_KEY is required for password login',
      });
    }

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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

    res.json({
      message: 'Login successful',
      uid: localId || userDoc.id,
      idToken,
      refreshToken,
      expiresIn,
      username: userData.username,
      role: userData.role,
      barangay: userData.barangay,
      full_name: `${userData.first_name} ${userData.last_name}`,
    });
  } catch (error) {
    const status = error.response?.status === 400 ? 401 : 500;
    res.status(status).json({ error: getAuthErrorMessage(error) });
  }
});

// Send Firebase Auth password reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.body.email);

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

module.exports = router;
