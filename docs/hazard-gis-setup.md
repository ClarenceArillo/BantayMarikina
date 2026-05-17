# Hazard GIS Setup

This project uses a free map stack for the mobile app:

- Leaflet inside `react-native-webview`
- OpenStreetMap raster tiles
- Firebase Auth, Firestore, and Storage
- Expo Location for live GPS

## Install Dependencies

From `frontend/`:

```bash
npm install
npx expo install expo-location react-native-webview
npm install firebase
```

## Firebase Client Config

Create or update `frontend/.env`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/api
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

The first four Firebase values are required for Auth, Firestore, and Storage. `MESSAGING_SENDER_ID` and `APP_ID` are optional for the current app features, but you can copy them from Firebase Console > Project settings > Your apps > Web app when available.

Use your computer LAN IP for Android physical devices, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api
```

## Backend Config

Create or update `backend/.env`:

```bash
PORT=3000
HOST=0.0.0.0
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_WEB_API_KEY=...
```

The app logs in through the backend. The backend endpoint `POST /api/users/firebase-token` exchanges the verified login token for a Firebase custom token so the mobile app can securely use Firestore `onSnapshot` and Firebase Storage.

## Firestore Data

Collection: `Reports`

```json
{
  "hazardType": "Flood",
  "hazard_type": "Flood",
  "description": "Waist-level flood near bridge",
  "latitude": 14.6507,
  "longitude": 121.1029,
  "accuracyMeters": 18,
  "timestamp": "serverTimestamp",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "userId": "firebase-auth-uid",
  "sender_id": "firebase-auth-uid",
  "reporterName": "Juan Dela Cruz",
  "severity": "High",
  "barangay": "Barangka",
  "imageUrl": "https://...",
  "status": "active"
}
```

## Security Rules

Deploy these from the repo root or paste them in Firebase Console:

- `firestore.rules`
- `storage.rules`

## Run

Terminal 1:

```bash
cd backend
npm install
npm start
```

Terminal 2:

```bash
cd frontend
npm install
npm run start:lan
```

If a physical phone shows `The request timed out` for an `exp://192.168...:8081` URL, the phone cannot reach Metro on your computer. Common causes are Windows marking Wi-Fi as a Public network, firewall blocking Node/Metro, guest Wi-Fi/client isolation, VPN adapters, or the phone being on mobile data instead of the same local Wi-Fi.

For your current LAN IP, use:

```bash
cd frontend
npm run start:lan:ip
```

For Android physical devices, USB is more reliable than LAN when Windows Firewall or router isolation blocks `exp://192.168...`. Enable USB debugging, plug in the phone, accept the RSA prompt, then run:

```bash
cd frontend
npm run start:android-usb
```

This forwards phone ports `8081` and `3000` to the computer over USB. Keep `EXPO_PUBLIC_API_URL` empty in `frontend/.env` for this mode so the app can infer `http://127.0.0.1:3000/api` from Expo's localhost URL.

If the script prints `adb.exe: no devices/emulators found`, Android is not available to ADB yet. On the phone, enable Developer options > USB debugging, reconnect the cable in file-transfer mode if needed, and accept the "Allow USB debugging?" prompt.

If LAN still times out, use Expo's tunnel mode:

```bash
cd frontend
npm run start:tunnel
```

For LAN mode, allow inbound TCP ports `8081`, `19000`, `19001`, `19002`, and `3000`, plus UDP ports `19000`, `19001`, and `19002`, in Windows Firewall. The backend must stay on `HOST=0.0.0.0`. You can leave `EXPO_PUBLIC_API_URL` empty so the app infers the backend URL from Expo's host, or set it to `http://YOUR_LAN_IP:3000/api`.

For iOS with Expo Go, there is no ADB-style USB port reverse. Use LAN after making the Windows Wi-Fi network Private/opening firewall ports, or use tunnel mode on a network where ngrok is not blocked.

Open the Expo app on Android. Sign in, then use:

- Home: mini live map preview
- Map: full Leaflet/OpenStreetMap hazard map
- Report: GPS-based hazard report submission with optional image

## Production Notes

OpenStreetMap public tiles are free but have usage limits and attribution requirements. For LGU deployment with heavy traffic, use a self-hosted tile server or a free/open-source tile provider plan that permits your expected usage.
