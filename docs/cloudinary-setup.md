# Cloudinary Setup for BantayMarikina

BantayMarikina uses Cloudinary for report images, report videos, and profile photos. Uploads are signed by the backend so the frontend can upload directly to Cloudinary without exposing the Cloudinary API secret.

## Why Cloudinary Is Used

Cloudinary provides:

- Direct mobile/web upload support.
- Secure HTTPS media URLs.
- Image and video delivery optimization.
- Automatic format and quality transformations.
- Server-side deletion by `public_id`.
- Separation between media binaries and Firestore metadata.

Firebase Storage rules are still present as a protected fallback, but the current app media flow uses Cloudinary.

## Required Backend Environment

Set Cloudinary values only in trusted backend runtimes.

`backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Alternative single-variable format:

```env
CLOUDINARY_URL=cloudinary://your_cloudinary_api_key:your_cloudinary_api_secret@your_cloudinary_cloud_name
```

Never place `CLOUDINARY_API_SECRET` or `CLOUDINARY_URL` in `frontend/.env`.

## Firebase Functions Environment

Cloud Functions also need Cloudinary credentials for cleanup triggers that delete report media when reports are removed or deleted.

Configure the same Cloudinary values in the Firebase Functions runtime environment before deploying functions. The exact command depends on your Firebase/Google Cloud setup. Common production approaches include:

- Google Cloud Secret Manager
- Firebase Functions environment variables
- CI/CD deployment environment variables

Then deploy:

```bash
firebase deploy --only functions
```

## Allowed Upload Folders

The backend signs uploads only for these folders:

| Folder | Resource Type | Use Case |
| --- | --- | --- |
| `reports/images` | `image` | Hazard report images |
| `reports/videos` | `video` | Hazard report videos |
| `profiles` | `image` | User profile photos |

The backend generates public IDs using the authenticated Firebase UID:

```text
{folder}/{uid}/{timestamp}-{random_nonce}
```

This lets the backend verify ownership before allowing deletion or profile photo attachment.

## Size and Type Limits

| Media | Limit | Accepted Types |
| --- | --- | --- |
| Images | 8 MB | JPEG, JPG, PNG, WEBP |
| Videos | 80 MB | MP4, QuickTime/MOV |

The frontend sends file size and MIME type to `/api/media/cloudinary/sign-upload`. The backend validates the request before returning a signature.

## Upload Flow

```text
Expo app
  |
  | mediaUri, bytes, folder, resourceType, MIME type
  v
POST /api/media/cloudinary/sign-upload
  |
  | Authorization: Bearer <Firebase ID token>
  | Backend verifies token and signs Cloudinary params
  v
Frontend direct upload to Cloudinary
  |
  | secure_url, public_id, resource_type, dimensions, duration, bytes
  v
Firestore report/profile metadata
```

## Relevant Files

| File | Responsibility |
| --- | --- |
| `frontend/services/cloudinaryService.ts` | Requests upload signature, uploads media, optimizes URLs, requests deletion. |
| `frontend/services/profilePhotoService.ts` | Uploads/removes profile photos and updates local profile state. |
| `frontend/services/hazardReportService.ts` | Uploads report media before creating report documents. |
| `backend/routes/media.js` | Signs uploads, validates media, deletes owned assets, saves profile photo metadata. |
| `functions/index.js` | Deletes Cloudinary report media when reports are removed/deleted. |

## Backend Endpoints

### Check Status

```http
GET /api/media/cloudinary/status
Authorization: Bearer <Firebase ID token>
```

Expected response:

```json
{
  "connected": true,
  "cloudName": "your_cloud_name",
  "hasApiKey": true,
  "hasApiSecret": true,
  "uploadFolders": ["reports/images", "reports/videos", "profiles"]
}
```

### Sign Upload

```http
POST /api/media/cloudinary/sign-upload
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Example body:

```json
{
  "bytes": 512000,
  "folder": "reports/images",
  "mimeType": "image/jpeg",
  "resourceType": "image"
}
```

### Delete Media

```http
POST /api/media/cloudinary/delete
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Example body:

```json
{
  "publicId": "reports/images/uid/1234567890-abc123",
  "resourceType": "image"
}
```

The backend allows deletion only if the `publicId` belongs to the authenticated UID.

## Profile Photo Flow

1. User selects a photo in the Profile screen.
2. Frontend uploads it to Cloudinary folder `profiles`.
3. Frontend sends returned media metadata to:

```text
POST /api/media/cloudinary/profile-photo
```

4. Backend verifies:

- Authenticated user.
- `public_id` belongs to `profiles/{uid}/`.
- `secure_url` belongs to the configured Cloudinary cloud.

5. Backend updates `Users/{uid}` with:

```text
photoURL
profilePhotoUrl
profile_photo_url
profilePhotoMedia
updated_at
```

6. If there was a previous profile photo, the frontend requests deletion through the backend.

## Report Media Flow

1. User captures image or video in Report screen.
2. Frontend signs upload through backend.
3. Frontend uploads media to Cloudinary.
4. Firestore `Reports/{reportId}` stores:

```text
imageUrl
image_url
cloudinaryMedia
media[]
capturedAtLabel
```

5. Cloud Functions delete report media when the report is deleted or auto-removed by moderation. Owner-initiated report deletion also removes the report's Firestore engagement subcollections and related notification documents.

## URL Optimization

The frontend rewrites Cloudinary URLs for efficient delivery:

```text
f_auto,q_auto:eco,c_limit,w_900
```

Video previews use generated JPG poster URLs. Captured-at labels can be rendered as Cloudinary text overlays for report media display.

## Troubleshooting

### Upload endpoint says media uploads are unavailable

Check backend `.env`:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Restart backend after changing `.env`.

### Status endpoint returns `connected: false`

At least one required Cloudinary value is missing or the secret is still a placeholder.

### Upload succeeds but profile photo is rejected

The uploaded asset must be under:

```text
profiles/{uid}/...
```

Do not manually attach a Cloudinary URL from another account or folder.

### Cleanup does not delete removed report media

Check that Firebase Functions have Cloudinary credentials and were deployed after updating environment variables.

```bash
firebase deploy --only functions
```

### Frontend upload retries but still fails

Check:

- File is below the size limit.
- MIME type is supported.
- Device has stable network.
- Backend API URL is reachable from the phone.
- Cloudinary account upload quota is available.
