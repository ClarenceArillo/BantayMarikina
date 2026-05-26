# BantayMarikina Setup Guide

This guide explains how to run the current BantayMarikina app on a developer machine and how to prepare Firebase, Cloudinary, backend services, and Expo so other users can test the app.

BantayMarikina is currently composed of:

- Expo + React Native frontend
- Node/Express backend
- Firebase Authentication
- Firestore realtime database
- Firebase Cloud Functions
- Firebase security rules and indexes
- Cloudinary signed media uploads
- Leaflet/OpenStreetMap map rendering inside `react-native-webview`
- External weather, water level, PAGASA, and PHIVOLCS polling through the backend

## 1. Prerequisites

Install these before running the project:

| Tool | Purpose |
| --- | --- |
| Node.js 20+ | Required for backend and Firebase Functions. |
| npm | Dependency installation and scripts. |
| Expo Go | Mobile app testing on Android/iOS. |
| Firebase CLI | Deploy rules, indexes, and Cloud Functions. |
| Git | Clone and manage the repository. |
| Android platform tools / ADB | Optional but recommended for Android USB testing. |

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
firebase login
```

## 2. Install Dependencies

From the repo root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix functions install
```

The frontend already includes the current required app packages, including Expo, Firebase, `expo-location`, `expo-image-picker`, `react-native-webview`, and Reanimated.

## 3. Firebase Project Setup

Create or open a Firebase project, then enable:

1. Firebase Authentication
2. Firestore Database
3. Cloud Functions
4. Cloud Messaging
5. Firebase Storage if you want to keep the protected fallback rules available

### Authentication

Enable the Email/Password sign-in provider in Firebase Console:

```text
Firebase Console -> Authentication -> Sign-in method -> Email/Password
```

### Web App Config

Create a Firebase Web App in Project Settings and copy the web config values for `frontend/.env`.

Required frontend values:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000/api
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Notes:

- `EXPO_PUBLIC_*` values are bundled into the frontend. Do not put Cloudinary secrets or Firebase service account keys here.
- Firebase web config values are public identifiers. Access control is enforced by Firebase Auth and security rules.
- For Android emulator, the app can use `http://10.0.2.2:3000/api` automatically when no Expo host is available.
- For physical devices on LAN, use your computer's LAN IP, for example `http://192.168.1.20:3000/api`.

### Service Account for Backend

The Express backend uses Firebase Admin SDK. Create a service account key:

```text
Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
```

Save it as:

```text
backend/serviceAccountKey.json
```

This file is ignored by Git and must never be committed.

## 4. Backend Environment

Create `backend/.env`:

```env
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:8081,http://localhost:19006
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_WEB_API_KEY=your_firebase_web_api_key

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

OFFICIAL_ALERT_API_KEY=use_a_long_random_value_for_server_to_server_alerts
```

You may also use Cloudinary's single URL format instead of the three separate Cloudinary variables:

```env
CLOUDINARY_URL=cloudinary://your_cloudinary_api_key:your_cloudinary_api_secret@your_cloudinary_cloud_name
```

### Why the Backend Needs `FIREBASE_WEB_API_KEY`

The backend uses Firebase Identity Toolkit endpoints for:

- Email/username + password login
- Password reset email
- Reauthentication before password changes

The backend also creates Firebase custom tokens so the frontend can sign into Firebase client SDK and use Firestore realtime listeners safely.

## 5. Cloudinary Setup

BantayMarikina currently uploads report images, report videos, and profile photos to Cloudinary through signed uploads.

Allowed upload folders:

```text
reports/images
reports/videos
profiles
```

Cloudinary secrets must exist only in:

- `backend/.env`
- Firebase Functions runtime environment, if deploying report media cleanup functions

They must not exist in:

- `frontend/.env`
- frontend source files
- committed docs with real secret values

See [cloudinary-setup.md](cloudinary-setup.md) for the detailed Cloudinary flow.

## 6. Firebase Rules, Indexes, and Functions

The current app depends on Firestore rules, indexes, and Cloud Functions matching the frontend write model.

Deploy from the repo root:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Or deploy pieces separately:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy --only functions
```

Important: deploy `functions` together with the latest `firestore.rules` when using the current app. The frontend now writes only user-owned interaction documents for likes, comments, views, and flags. Cloud Functions maintain trusted aggregate counters and moderation state.

### Current Security Model

| Area | Current Behavior |
| --- | --- |
| Reports | Authenticated users can create only their own reports inside Marikina bounds. |
| Report cooldown | `ReportSubmissionGuards/{uid}` enforces lightweight anti-spam. |
| Comments | Authenticated users create sanitized comments with guard-based cooldown. |
| Likes/views | One document per user per report. |
| Notifications | Created by trusted backend/functions, read by permitted audience. |
| Moderation | User flag docs are client-writable, but moderation counters/actions are function-owned. |
| Profile media | Cloudinary asset must belong to the signed-in user. |
| Storage | Firebase Storage is locked to owner-owned image paths if used. |

## 7. Firestore Seed Data

### Required Collections

The app can create users and reports through normal usage, but these collections are expected by features:

| Collection | How It Is Populated |
| --- | --- |
| `Users` | Backend signup creates user documents. |
| `Reports` | Report screen writes community reports. |
| `Notifications` | Cloud Functions and backend official alert pollers write notifications. |
| `DashboardData` | Backend dashboard cache writes weather and water level docs. |
| `EvacuationSites` | Seed script writes evacuation sites. |

### Seed Evacuation Sites

From repo root:

```bash
npm --prefix backend run seed:evacuation-sites
```

### Optional Test Reports

```bash
npm --prefix backend run seed:test-reports
```

Cleanup test reports:

```bash
npm --prefix backend run cleanup:test-reports
```

## 8. Run the App Locally

### Terminal 1: Backend

```bash
npm --prefix backend run dev
```

The backend starts on:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

### Terminal 2: Frontend

```bash
npm --prefix frontend run start:lan
```

Open Expo Go and scan the QR code.

## 9. Running on Android

### LAN Mode

Set:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/api
```

Then run:

```bash
npm --prefix frontend run start:lan
```

If Expo or backend requests time out, check:

- Phone and computer are on the same Wi-Fi.
- Phone is not on mobile data.
- Windows network profile is Private.
- Firewall allows Node/Metro/backend.
- Router does not use guest Wi-Fi or client isolation.

Allow inbound firewall access for:

```text
TCP: 3000, 8081, 19000, 19001, 19002
UDP: 19000, 19001, 19002
```

### Android USB Mode

USB mode is more reliable when LAN or firewall settings block Expo.

Enable:

```text
Developer options -> USB debugging
```

Then run:

```bash
npm --prefix frontend run start:android-usb
```

This reverses Android device ports `8081` and `3000` to the computer. Keep `EXPO_PUBLIC_API_URL` empty for this mode so the app can infer the backend URL from Expo's localhost host.

If you see:

```text
adb.exe: no devices/emulators found
```

Reconnect the device, set USB mode to file transfer if needed, and accept the "Allow USB debugging?" prompt.

## 10. Running on iOS

iOS does not support Android-style ADB port reverse.

Use either:

- LAN mode on the same Wi-Fi network
- Expo tunnel mode

```bash
npm --prefix frontend run start:tunnel
```

## 11. Remote Testing

From the repo root:

```bash
npm run remote
```

This script starts the backend, creates a public backend URL, and updates `frontend/.env` with the remote API URL. It attempts Expo tunnel first. If tunnel setup fails, it may fall back to a browser-accessible frontend URL depending on the script path and available tunnel provider.

Stop remote helpers:

```bash
npm run remote:stop
```

## 12. Current App Features to Verify

After setup, verify these flows:

1. Create an account.
2. Log in with email or username.
3. Open Home and confirm weather/water level cards render.
4. Open Map and confirm Leaflet/OpenStreetMap loads.
5. Submit a hazard report with GPS.
6. Submit a hazard report with image or video media.
7. Confirm the report appears on Map and Home preview.
8. Open Notifications and confirm the new report notification appears.
9. Open a report detail sheet and test like/comment/view behavior.
10. Upload a profile photo.
11. Change username.
12. Change password with current password.
13. Log out and log back in.

## 13. Troubleshooting

### Login Works but Firestore Data Does Not Load

Check that:

- `/api/users/firebase-token` works.
- Firebase Functions/rules are deployed.
- Frontend Firebase env values match the same Firebase project as the backend service account.

### Report Submission Fails with Permission Denied

Usually caused by rules/functions mismatch.

Fix:

```bash
firebase deploy --only firestore:rules,functions
```

Also confirm the user is signed in and the GPS coordinates are inside Marikina bounds.

### Media Upload Fails

Check:

- Cloudinary env values are set on the backend.
- Backend was restarted after updating `.env`.
- The upload file is below the configured size limit.
- The media type is supported.

Authenticated status endpoint:

```text
GET /api/media/cloudinary/status
Authorization: Bearer <firebase_id_token>
```

Expected:

```json
{
  "connected": true,
  "cloudName": "your_cloud_name",
  "hasApiKey": true,
  "hasApiSecret": true
}
```

### Home Dashboard Shows Source Offline

The backend may be using fallback/stale data because an external source is unavailable. This is expected behavior when Open-Meteo, BantayBaha, PANaHON, or old PAGASA FFWS endpoints are slow or unreachable.

Restart backend or force refresh through:

```text
GET /api/weather?refresh=true
GET /api/waterlevel?refresh=true
```

### Expo Go Cannot Reach Backend

Use one of:

- Set `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/api`
- Use Android USB mode
- Use Expo tunnel mode
- Use root `npm run remote`

## 14. Production Notes

Before production deployment:

- Use HTTPS for backend API.
- Restrict `CORS_ORIGIN`.
- Store secrets in managed runtime env/secret manager.
- Deploy Firestore rules, indexes, Storage rules, and Functions.
- Rotate any service account key that was shared accidentally.
- Configure Firebase Auth authorized domains.
- Monitor Cloud Functions logs.
- Review Cloudinary account upload limits.
- Consider App Check for Firebase and backend abuse protection.
- Consider Redis/Cloud Memorystore for rate limiting if scaling backend horizontally.

OpenStreetMap public tiles are free but have usage and attribution requirements. For heavy LGU deployment, use a tile provider plan or self-hosted tile server.
