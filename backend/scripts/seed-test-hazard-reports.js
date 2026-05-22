require('dotenv').config();

const { admin, db } = require('../firebase');

const SEED_ID = 'bantaymarikina_test_reports_v1';
const TEST_USER_ID = 'test-user-clara-mheights';
const REPORTS_COLLECTION = 'Reports';
const NOTIFICATIONS_COLLECTION = 'Notifications';
const SEED_RUNS_COLLECTION = 'SeedRuns';
const USERS_COLLECTION = 'Users';

const author = {
  full_name: 'Maria Santos Gomez',
  username: 'clara_mheights',
  email: 'clara.gomez@email.com',
  role: 'resident',
  gender: 'Female',
  contact_number: '09189876543',
  barangay: 'Marikina Heights',
  street_block: 'Champagnat Street',
  house_number: 'Block 12 Lot 5',
};

const reportSeeds = [
  {
    id: 'test-report-flood-marikina-heights-v1',
    hazardType: 'Flood',
    severity: 'Moderate',
    barangay: 'Marikina Heights',
    latitude: 14.64772,
    longitude: 121.11914,
    minutesAgo: 35,
    description: 'Gutter overflow and ankle-deep flooding reported along Champagnat Street after continuous rain. Motorcycles are slowing down near the low section.',
  },
  {
    id: 'test-report-landslide-nangka-v1',
    hazardType: 'Landslide',
    severity: 'Low',
    barangay: 'Nangka',
    latitude: 14.67531,
    longitude: 121.10863,
    minutesAgo: 95,
    description: 'Small soil movement observed beside a sloped residential lane near Nangka. No injuries reported, but loose soil is close to the roadside.',
  },
  {
    id: 'test-report-fire-concepcion-uno-v1',
    hazardType: 'Fire',
    severity: 'High',
    barangay: 'Concepcion Uno',
    latitude: 14.65084,
    longitude: 121.10191,
    minutesAgo: 160,
    description: 'Smoke and visible flames reported from a small structure near a residential compound in Concepcion Uno. Residents nearby are moving away from the area.',
  },
];

function usernameKey(username) {
  return String(username || '').trim().toLowerCase();
}

function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

function buildAuthorProfile() {
  return {
    first_name: 'Maria',
    middle_name: 'Santos',
    last_name: 'Gomez',
    suffix: '',
    gender: author.gender,
    contact_number: author.contact_number,
    email: emailKey(author.email),
    email_lower: emailKey(author.email),
    barangay: author.barangay,
    street_block: author.street_block,
    house_number: author.house_number,
    username: author.username,
    username_lower: usernameKey(author.username),
    role: author.role,
    name: {
      first: 'Maria',
      middle: 'Santos',
      last: 'Gomez',
      suffix: '',
      full: author.full_name,
    },
    address: {
      barangay: author.barangay,
      street_block: author.street_block,
      house_number: author.house_number,
    },
  };
}

async function findExistingUserId() {
  const byUsername = await db.collection(USERS_COLLECTION)
    .where('username_lower', '==', usernameKey(author.username))
    .limit(1)
    .get();

  if (!byUsername.empty) return byUsername.docs[0].id;

  const byEmail = await db.collection(USERS_COLLECTION)
    .where('email_lower', '==', emailKey(author.email))
    .limit(1)
    .get();

  return byEmail.empty ? TEST_USER_ID : byEmail.docs[0].id;
}

function reportTime(minutesAgo) {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() - minutesAgo * 60 * 1000));
}

function buildReport(seed, userId) {
  const timestamp = reportTime(seed.minutesAgo);
  const title = `${seed.severity} ${seed.hazardType}`;

  return {
    title,
    hazardType: seed.hazardType,
    hazard_type: seed.hazardType,
    description: seed.description,
    latitude: seed.latitude,
    longitude: seed.longitude,
    location: {
      latitude: seed.latitude,
      longitude: seed.longitude,
    },
    accuracyMeters: 18,
    severity: seed.severity,
    barangay: seed.barangay,
    userId,
    sender_id: userId,
    reporterName: author.full_name,
    reporterUsername: author.username,
    reporterPhotoUrl: '',
    reporter_photo_url: '',
    imageUrl: null,
    image_url: null,
    cloudinaryMedia: null,
    media: [],
    source: 'community',
    moderationStatus: 'visible',
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    userReportCount: 0,
    reportCategoryCounts: {},
    status: 'active',
    timestamp,
    createdAt: timestamp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    seedId: SEED_ID,
    isTestReport: true,
  };
}

function buildNotification(seed, reportId) {
  const timestamp = reportTime(seed.minutesAgo);
  return {
    audience: 'all',
    type: 'new_report',
    reportId,
    title: `${seed.severity} ${seed.hazardType}`,
    body: seed.description,
    hazardType: seed.hazardType,
    severity: seed.severity,
    imageUrl: null,
    latitude: seed.latitude,
    longitude: seed.longitude,
    barangay: seed.barangay,
    reporterName: author.full_name,
    reporterUsername: author.username,
    createdAt: timestamp,
    seedId: SEED_ID,
    isTestNotification: true,
  };
}

async function seedReports() {
  const seedRef = db.collection(SEED_RUNS_COLLECTION).doc(SEED_ID);
  const seedSnapshot = await seedRef.get();

  if (seedSnapshot.exists) {
    console.log(`Seed "${SEED_ID}" already exists. No reports inserted.`);
    return;
  }

  const existingReports = await Promise.all(
    reportSeeds.map((seed) => db.collection(REPORTS_COLLECTION).doc(seed.id).get())
  );

  if (existingReports.some((snapshot) => snapshot.exists)) {
    await seedRef.set({
      seedId: SEED_ID,
      skipped: true,
      reason: 'One or more deterministic test report IDs already exist.',
      reportIds: reportSeeds.map((seed) => seed.id),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('One or more test reports already exist. Seed marker written; no duplicates inserted.');
    return;
  }

  const userId = await findExistingUserId();
  const userRef = db.collection(USERS_COLLECTION).doc(userId);
  const userSnapshot = await userRef.get();
  const batch = db.batch();

  if (!userSnapshot.exists) {
    batch.set(userRef, {
      ...buildAuthorProfile(),
      created_by_seed: SEED_ID,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  reportSeeds.forEach((seed) => {
    const reportRef = db.collection(REPORTS_COLLECTION).doc(seed.id);
    const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc(`test-notification-${seed.id}`);

    batch.set(reportRef, buildReport(seed, userId));
    batch.set(notificationRef, buildNotification(seed, seed.id));
  });

  batch.set(seedRef, {
    seedId: SEED_ID,
    reportIds: reportSeeds.map((seed) => seed.id),
    notificationIds: reportSeeds.map((seed) => `test-notification-${seed.id}`),
    userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log(`Inserted ${reportSeeds.length} test hazard reports for ${author.full_name}.`);
  reportSeeds.forEach((seed) => {
    console.log(`- ${seed.id}: ${seed.severity} ${seed.hazardType}, ${seed.barangay} (${seed.latitude}, ${seed.longitude})`);
  });
}

async function deleteCollectionDocs(collectionRef) {
  const snapshot = await collectionRef.get();
  const batch = db.batch();
  snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
  if (!snapshot.empty) await batch.commit();
}

async function cleanupReports() {
  const seedRef = db.collection(SEED_RUNS_COLLECTION).doc(SEED_ID);
  const seedSnapshot = await seedRef.get();
  const seedData = seedSnapshot.data() || {};
  const reportIds = seedData.reportIds || reportSeeds.map((seed) => seed.id);
  const notificationIds = seedData.notificationIds || reportSeeds.map((seed) => `test-notification-${seed.id}`);
  const batch = db.batch();

  for (const reportId of reportIds) {
    const reportRef = db.collection(REPORTS_COLLECTION).doc(reportId);
    await deleteCollectionDocs(reportRef.collection('likes'));
    await deleteCollectionDocs(reportRef.collection('comments'));
    await deleteCollectionDocs(reportRef.collection('userViews'));
    await deleteCollectionDocs(reportRef.collection('userReports'));
    batch.delete(reportRef);
  }

  notificationIds.forEach((notificationId) => {
    batch.delete(db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId));
  });

  if (seedSnapshot.exists) batch.delete(seedRef);

  const testUserRef = db.collection(USERS_COLLECTION).doc(TEST_USER_ID);
  const testUserSnapshot = await testUserRef.get();
  if (testUserSnapshot.data()?.created_by_seed === SEED_ID) {
    batch.delete(testUserRef);
  }

  await batch.commit();
  console.log(`Cleaned up test reports for seed "${SEED_ID}".`);
}

async function main() {
  const command = process.argv[2] || 'seed';

  if (command === 'cleanup') {
    await cleanupReports();
    return;
  }

  if (command !== 'seed') {
    throw new Error('Usage: node scripts/seed-test-hazard-reports.js [seed|cleanup]');
  }

  await seedReports();
}

main()
  .catch((error) => {
    console.error('Test hazard report seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.terminate();
  });
