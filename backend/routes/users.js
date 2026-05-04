const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');

// Register
router.post('/register', async (req, res) => {
  try {
    const {
      first_name, middle_name, last_name, suffix,
      gender, contact_number, email,
      barangay, street_block, house_number,
      username, password, confirm_password
    } = req.body;

    // Check if passwords match
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if username already exists
    const usernameCheck = await db.collection('Users')
      .where('username', '==', username)
      .get();

    if (!usernameCheck.empty) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
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
      email,
      barangay,
      street_block,
      house_number,
      username,
      role: 'resident',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      message: 'Account created successfully',
      uid: userRecord.uid,
      username,
      email,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login with email + password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user in Firestore by email
    const snapshot = await db.collection('Users')
      .where('email', '==', email)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Create a custom token
    const customToken = await admin.auth().createCustomToken(userDoc.id);

    res.json({
      message: 'Login successful',
      uid: userDoc.id,
      token: customToken,
      username: userData.username,
      role: userData.role,
      barangay: userData.barangay,
      full_name: `${userData.first_name} ${userData.last_name}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;