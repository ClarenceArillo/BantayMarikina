# Cloudinary Integration

BantayMarikina uploads report images, report videos, and profile photos to Cloudinary through a signed upload flow.

## Environment

Set this only on trusted backend runtimes, never in `frontend/.env`:

```env
CLOUDINARY_CLOUD_NAME=dk0nn4eqt
CLOUDINARY_API_KEY=477669543775514
CLOUDINARY_API_SECRET=<your_api_secret>
```

You can also use the single URL format:

```env
CLOUDINARY_URL=cloudinary://477669543775514:<your_api_secret>@dk0nn4eqt
```

The Cloudinary API key may be returned to the app for signed uploads, but the API secret must stay on the backend or Firebase Functions.

## Folders

- `reports/images`
- `reports/videos`
- `profiles`

## Flow

1. The app compresses selected media through Expo Image Picker quality settings.
2. The app asks `/api/media/cloudinary/sign-upload` for a scoped signature.
3. The app uploads directly to Cloudinary with progress and retry handling.
4. Firestore stores `secure_url`, `public_id`, `resource_type`, dimensions, duration, bytes, and creation metadata.
5. Profile replacement/removal and report moderation cleanup delete old Cloudinary assets through signed server-side destroy calls.

## Deployment

- Backend: add either `CLOUDINARY_URL` or the three separate Cloudinary variables to the Node/Express environment.
- Firebase Functions: add the same Cloudinary values as runtime environment variables before deploying cleanup triggers.
- Frontend: keep only public Expo/Firebase/API values in `frontend/.env`.

## Manual Cloudinary Setup

1. Open the Cloudinary Console and select cloud `dk0nn4eqt`.
2. Go to Dashboard, then copy the API Secret for API key `477669543775514`.
3. Add the secret to `backend/.env` as `CLOUDINARY_API_SECRET=...`.
4. Add the same Cloudinary values to Firebase Functions runtime config or environment variables.
5. Restart the backend server so `/api/media/cloudinary/sign-upload` uses the new secret.
6. Test by uploading a profile photo or report image. Successful uploads should appear under `profiles`, `reports/images`, or `reports/videos`.
7. If uploads fail, call `GET /api/media/cloudinary/status` with a Firebase bearer token. It should return `connected: true` and `hasApiSecret: true`.
