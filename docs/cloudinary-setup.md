# Cloudinary Integration

BantayMarikina uploads report images, report videos, and profile photos to Cloudinary through a signed upload flow.

## Environment

Set this only on trusted backend runtimes, never in `frontend/.env`:

```env
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@dk0nn4eqt
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

- Backend: add `CLOUDINARY_URL` to the Node/Express environment.
- Firebase Functions: add `CLOUDINARY_URL` as a runtime environment variable before deploying cleanup triggers.
- Frontend: keep only public Expo/Firebase/API values in `frontend/.env`.
