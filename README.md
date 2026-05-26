# BantayMarikina

BantayMarikina is a React Native + Expo realtime disaster monitoring app for Marikina City. It uses Firebase Authentication, Firestore realtime listeners, Firebase Cloud Functions, Cloudinary signed media uploads, an Express backend, and Leaflet/OpenStreetMap map rendering.

## Start Here

For setup and onboarding, read:

- [Setup Guide](docs/hazard-gis-setup.md)
- [Cloudinary Setup](docs/cloudinary-setup.md)
- [Full Architecture Documentation](docs/BANTAYMARIKINA_ARCHITECTURE.md)

## Quick Local Run

Install dependencies:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix functions install
```

Create environment files:

- `backend/.env`
- `frontend/.env`
- `backend/serviceAccountKey.json`

Use the examples:

- `backend/.env.example`
- `frontend/.env.example`

Run backend:

```bash
npm --prefix backend run dev
```

Run Expo frontend:

```bash
npm --prefix frontend run start:lan
```

Deploy Firebase rules, indexes, storage rules, and functions when using a real Firebase project:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## Important Notes

- Do not commit `backend/.env`, `frontend/.env`, or `backend/serviceAccountKey.json`.
- Cloudinary API secrets belong only in backend/Firebase Functions environments.
- Firestore rules and Cloud Functions must match the current frontend write flow because aggregate counters and moderation are server-owned.
