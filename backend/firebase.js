const admin = require('firebase-admin');
const path = require('path');

function getCredential() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
  const resolvedPath = path.resolve(__dirname, serviceAccountPath);

  try {
    const serviceAccount = require(resolvedPath);
    return admin.credential.cert(serviceAccount);
  } catch (error) {
    throw new Error(
      `Firebase service account could not be loaded from ${serviceAccountPath}. ` +
        'Set FIREBASE_SERVICE_ACCOUNT_PATH or place serviceAccountKey.json in the backend folder.'
    );
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: getCredential(),
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db };
