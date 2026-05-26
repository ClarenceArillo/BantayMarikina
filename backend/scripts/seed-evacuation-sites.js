require('dotenv').config();

const { admin, db } = require('../firebase');

const SEED_ID = 'marikina_evacuation_sites_v1';
const EVACUATION_SITES_COLLECTION = 'EvacuationSites';
const SEED_RUNS_COLLECTION = 'SeedRuns';

const evacuationSites = [
  { id: 'malanday-elementary-school', name: 'Malanday Elementary School', latitude: 14.6502, longitude: 121.0944 },
  { id: 'h-bautista-elementary-school', name: 'H. Bautista Elementary School', latitude: 14.6578, longitude: 121.1042 },
  { id: 'nangka-elementary-school', name: 'Nangka Elementary School', latitude: 14.6732, longitude: 121.1084 },
  { id: 'concepcion-integrated-school', name: 'Concepcion Integrated School', latitude: 14.65, longitude: 121.1021 },
  { id: 'concepcion-elementary-school', name: 'Concepcion Elementary School', latitude: 14.6482, longitude: 121.1039 },
  { id: 'sto-nino-elementary-school-and-national-high-school', name: 'Sto. Niño Elementary School and national high school', latitude: 14.6391, longitude: 121.0963 },
  { id: 'leodegario-victorino-elementary-school', name: 'Leodegario Victorino Elementary School', latitude: 14.6352, longitude: 121.0903 },
  { id: 'libis-bulelak-basketball-court', name: 'Libis Bulelak Basketball Court', latitude: 14.6525, longitude: 121.096 },
  { id: 'marikina-elementary-school', name: 'Marikina Elementary School', latitude: 14.6311, longitude: 121.0976 },
  { id: 'sta-elena-high-school', name: 'Sta Elena High School', latitude: 14.6324, longitude: 121.0974 },
  { id: 'kalumpang-elementary-school-and-national-high-school', name: 'Kalumpang Elementary School and national high school', latitude: 14.6223, longitude: 121.0903 },
  { id: 'san-roque-elementary-school-and-high-school', name: 'San Roque Elementary School and high school', latitude: 14.6228, longitude: 121.097 },
  { id: 'barangka-elementary-school', name: 'Barangka Elementary School', latitude: 14.6334, longitude: 121.0819 },
  { id: 'tanong-high-school', name: 'Tañong High School', latitude: 14.6341, longitude: 121.0854 },
  { id: 'pamantasan-ng-lungsod-ng-marikina', name: 'Pamantasan ng Lungsod ng Marikina', latitude: 14.6582, longitude: 121.1064 },
  { id: 'ivs-covered-court', name: 'IVS Covered Court', latitude: 14.6238, longitude: 121.076 },
  { id: 'marikina-high-school', name: 'Marikina High School', latitude: 14.6471, longitude: 121.103 },
  { id: 'parang-elementary-school', name: 'Parang Elementary School', latitude: 14.6578, longitude: 121.1118 },
  { id: 'parang-high-school', name: 'Parang High School', latitude: 14.6631, longitude: 121.1125 },
  { id: 'fortune-elementary-school-and-high-school', name: 'Fortune Elementary School and high school', latitude: 14.6631, longitude: 121.1125 },
  { id: 'sss-village-elementary-school-and-high-school', name: 'SSS Village Elementary School and high school', latitude: 14.64, longitude: 121.121 },
  { id: 'kap-moy-elementary-school', name: 'Kap. Moy Elementary School', latitude: 14.649, longitude: 121.1186 },
  { id: 'marikina-heights-high-school', name: 'Marikina Heights High School', latitude: 14.6482, longitude: 121.1193 },
];

async function seedEvacuationSites() {
  const seedRef = db.collection(SEED_RUNS_COLLECTION).doc(SEED_ID);
  const seedSnapshot = await seedRef.get();

  if (seedSnapshot.exists) {
    console.log(`Seed "${SEED_ID}" already exists. No evacuation sites inserted.`);
    return;
  }

  const batch = db.batch();

  evacuationSites.forEach((site, index) => {
    const siteRef = db.collection(EVACUATION_SITES_COLLECTION).doc(site.id);

    batch.set(siteRef, {
      ...site,
      active: true,
      sortOrder: index + 1,
      source: SEED_ID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
  });

  batch.set(seedRef, {
    seedId: SEED_ID,
    collection: EVACUATION_SITES_COLLECTION,
    siteIds: evacuationSites.map((site) => site.id),
    siteCount: evacuationSites.length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log(`Inserted ${evacuationSites.length} evacuation sites.`);
}

seedEvacuationSites()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.terminate();
  });
