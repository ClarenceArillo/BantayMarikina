# BantayMarikina Technical Architecture Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Firebase Architecture](#firebase-architecture)
5. [Authentication System](#authentication-system)
6. [Cloudinary Integration](#cloudinary-integration)
7. [Map System](#map-system)
8. [Notification System](#notification-system)
9. [Official Alert System](#official-alert-system)
10. [Realtime System](#realtime-system)
11. [Social Interaction System](#social-interaction-system)
12. [Security Architecture](#security-architecture)
13. [Performance Optimization](#performance-optimization)
14. [File and Folder Structure](#file-and-folder-structure)
15. [Database Schema](#database-schema)
16. [API and Backend Flow](#api-and-backend-flow)
17. [Error Handling and Stability](#error-handling-and-stability)
18. [Deployment and Development](#deployment-and-development)
19. [Future Scalability](#future-scalability)

---

## Project Overview

BantayMarikina is a React Native and Expo realtime disaster monitoring application focused on Marikina City. It combines community-generated hazard reports, official alerts, live dashboard data, map visualization, notifications, profile management, social engagement, moderation, and media uploads into one mobile-first system.

The system is designed around a hybrid disaster monitoring model:

| Source | Purpose | Storage | Delivery |
| --- | --- | --- | --- |
| Community reports | Residents submit localized hazards with GPS and optional media. | Firestore `Reports` | Realtime map, feed, notification docs, FCM topic |
| Official alerts | Backend polls trusted public sources such as PAGASA and PHIVOLCS. | Firestore `Notifications` | Realtime notifications |
| Dashboard telemetry | Weather and water level data are cached by backend services. | Firestore `DashboardData` | Home dashboard realtime listeners |
| Evacuation sites | Seeded reference locations for map overlays. | Firestore `EvacuationSites` | Realtime map layer |

The project goal is to provide fast situational awareness while keeping the app lightweight enough for mobile networks and low-end Android devices. Firebase is used for realtime synchronization and identity, Cloudinary for optimized media, and an Express backend for protected operations that require secrets or external API polling.

### Key Features

- Firebase Authentication-backed signup, login, password changes, and profile sessions.
- Home dashboard with weather, river/water level status, safety tips, and live hazard preview.
- Map view powered by Leaflet/OpenStreetMap inside a React Native WebView.
- Community hazard reporting with GPS, image/video capture, Cloudinary upload, and Firestore persistence.
- Realtime notifications for community reports, official alerts, and moderation outcomes.
- Social interactions: likes, comments, views, and community flagging.
- Auto-moderation after five different authenticated users flag the same report.
- Profile photo uploads and profile updates.
- Dark mode and themed UI primitives.
- Backend polling for official sources and dashboard data.
- Practical security rules, signed media uploads, input sanitization, and rate limiting.

---

## System Architecture

BantayMarikina is split into four major execution layers:

1. **Expo frontend**: UI, navigation, Firebase client listeners, map rendering, local validation.
2. **Express backend**: Auth-related REST endpoints, Cloudinary upload signatures, external source polling, dashboard cache API.
3. **Firebase platform**: Authentication, Firestore, Storage rules, Cloud Functions, FCM.
4. **External services**: Cloudinary, OpenStreetMap/Leaflet CDN, Open-Meteo, BantayBaha, PANaHON/PAGASA sources, PHIVOLCS.

### High-Level Architecture

```text
Resident Mobile/Web App
        |
        | Firebase Auth custom-token session
        v
Firebase Auth  <-------------------- Express Backend
        |                              |
        | Firestore SDK                | Admin SDK
        v                              v
Firestore <-------------------- Dashboard/Official Alert Pollers
        |
        | Cloud Functions triggers
        v
Cloud Functions ----> FCM topic message
        |
        | signed delete cleanup
        v
Cloudinary Admin API

Frontend media upload:
App -> Backend signed upload endpoint -> Cloudinary direct upload -> Firestore report/profile metadata
```

### Main Request and Realtime Flows

#### Community Report Submission

```text
Report screen
  |
  | 1. GPS location from expo-location
  | 2. Optional camera media from expo-image-picker
  v
Frontend validation
  |
  | If media exists
  v
Backend /api/media/cloudinary/sign-upload
  |
  | signed upload params, authenticated by Firebase ID token
  v
Cloudinary upload
  |
  | secure_url and public_id returned
  v
Firestore batch write
  |
  | Reports/{reportId}
  | ReportSubmissionGuards/{userId}
  v
Cloud Function onReportCreated
  |
  | Creates Notifications/report_{reportId}
  | Sends FCM topic message
  v
Other clients receive realtime updates through onSnapshot
```

#### Realtime Synchronization

```text
Firestore write
  |
  v
Firestore local cache and server sync
  |
  v
onSnapshot listeners
  |
  +--> useHazardReports -> Map/Home/Report feed
  +--> useNotifications -> Notification screen
  +--> useReportEngagement -> details sheet/comments
  +--> subscribeDashboardData -> Home dashboard
  +--> subscribeToEvacuationSites -> Map evacuation layer
```

#### Media Upload Flow

```text
Frontend selects image/video
  |
  | bytes, folder, resourceType, MIME type
  v
POST /api/media/cloudinary/sign-upload
  |
  | verifies Firebase ID token
  | validates folder, type, size
  | signs Cloudinary params with backend-only API secret
  v
Frontend direct POST to Cloudinary
  |
  | receives secure_url, public_id, dimensions, format, bytes
  v
Firestore metadata only
```

---

## Frontend Architecture

The frontend lives in `frontend/` and uses:

- Expo Router for file-based navigation.
- React Native for UI.
- Firebase web SDK for Auth, Firestore, and Storage client access.
- React Native WebView for Leaflet map rendering.
- React Native Reanimated for UI transitions and small motion effects.
- Expo modules such as `expo-location`, `expo-image-picker`, `expo-asset`, and `expo-constants`.

### Navigation

The main authenticated routes are:

```text
home -> map -> report -> notification -> profile
```

`frontend/app/_layout.tsx` defines the root `Stack`, wraps the application in providers, displays `BottomNav` for main routes, and applies route-level animation. `frontend/services/mainTabNavigation.ts` centralizes main-tab ordering so moving forward and backward between Home, Map, Report, Notification, and Profile uses the correct left/right animation direction.

Authentication and signup routes are also part of the same Stack:

- `/`
- `/forgot-password`
- `/signup`
- `/signup/address`
- `/signup/security`

The `/hotline` screen is reachable from Home and uses regular stack navigation instead of bottom-tab semantics.

### State Management

The project intentionally avoids heavyweight global state libraries. It uses:

| Mechanism | Purpose |
| --- | --- |
| React context | Auth session, signup draft state, app theme. |
| React hooks | Realtime subscriptions, location, evacuation sites, engagement state. |
| Service modules | Firestore reads/writes, API calls, Cloudinary, dashboard cache. |
| AsyncStorage | Profile photo URI cache and small device-local state. |

This keeps the app lightweight while still separating UI from data access.

### Important Screens

#### Home Dashboard: `frontend/app/home.tsx`

The Home screen is the operational overview. It displays:

- User greeting and profile photo.
- Weather and forecast data from `DashboardData/weather`.
- Water level station status from `DashboardData/waterlevel`.
- Live hazard report preview through `useHazardReports`.
- Safety tips modal.
- Buttons for map, evacuation map, and hotline.

It subscribes to dashboard data with `subscribeDashboardData`, which shares one Firestore listener per dashboard document across all local subscribers. This avoids creating redundant listeners when multiple components need the same data.

#### Map: `frontend/app/map.tsx`

The Map screen renders the main geospatial view:

- Community hazard markers.
- Evacuation site markers.
- User location.
- Filters and selected report details.

It receives data from `useHazardReports`, `useEvacuationSites`, and `useLiveLocation`.

#### Report: `frontend/app/report.tsx`

The Report screen allows residents to submit a hazard. It:

- Watches GPS location.
- Captures image or video using Expo ImagePicker.
- Uploads media securely to Cloudinary.
- Writes the report to Firestore.
- Redirects to Map after successful submission.

#### Notifications: `frontend/app/notification.tsx`

Notifications are grouped by date buckets and filtered by:

- Date range, including a current-year window for annual alert review.
- Hazard type.
- Severity.
- Status.
- Source.

The notification list is ordered by date bucket first: Today, Yesterday, This Week, This Month, This Year, then Older. Within each bucket, severity, magnitude, intensity/signal level, and creation time are used as tie-breakers.

The screen maintains read/unread state through `NotificationReads`.

#### Profile: `frontend/app/profile.tsx`

Profile supports:

- Loading profile via backend `/api/users/me`.
- Updating profile fields.
- Updating username.
- Changing password with current password verification.
- Uploading/removing Cloudinary profile photo.
- Logout cleanup, including Firebase sign-out and cached photo removal.

#### Safety Tips

`SafetyTipsModal` is a themed modal that provides disaster preparedness content without leaving the main dashboard.

#### Hotline

The Hotline screen provides emergency contact information and is reached from Home using regular stack navigation.

### Hooks Architecture

| Hook | Responsibility |
| --- | --- |
| `useHazardReports` | Ensures Firebase session, subscribes to `Reports`, handles AppState start/stop. |
| `useNotifications` | Ensures Firebase session, subscribes to notifications, reads, and report references. |
| `useReportEngagement` | Subscribes to likes, comments, counts, and current user's engagement state. |
| `useLiveLocation` | Handles permission, one-shot location, and continuous location watch. |
| `useEvacuationSites` | Subscribes to active evacuation sites. |

The hooks clean up listeners on unmount and stop realtime subscriptions when the app moves to the background.

### Theming and Dark Mode

Theme state is provided by `frontend/theme/ThemeProvider.tsx` and consumed through `useTheme` or `useAppTheme`. The theme system centralizes colors, spacing, typography, shadows, and gradients so screens can stay consistent. The map also changes tile providers for dark mode, using Carto dark tiles instead of standard OSM tiles.

---

## Firebase Architecture

Firebase is used because it provides:

- Managed authentication.
- Realtime Firestore listeners.
- Cloud Functions triggers.
- Security rules at the data boundary.
- FCM topic messaging.
- A scalable operational model without maintaining custom WebSocket infrastructure.

### Firebase Components

| Firebase Product | Usage |
| --- | --- |
| Authentication | User identity, ID tokens, custom token frontend Firebase session. |
| Firestore | Reports, notifications, dashboard data, users, engagement, moderation, evacuation sites. |
| Cloud Functions | Trusted server-side reactions to Firestore writes. |
| Cloud Messaging | Topic message for new community reports. |
| Storage | Rules are present for Firebase Storage paths, although current media flow primarily uses Cloudinary. |

### Firestore Collections

| Collection | Purpose |
| --- | --- |
| `Users` | User profile metadata, role, username, profile photo references. |
| `Reports` | Community hazard reports. |
| `Reports/{reportId}/likes` | One like document per user. |
| `Reports/{reportId}/comments` | Report comments. |
| `Reports/{reportId}/userViews` | One view document per user. |
| `Reports/{reportId}/userReports` | One flag/report document per user. |
| `Notifications` | Public and user-targeted notification documents. |
| `NotificationReads` | Read state keyed by user and notification. |
| `ReportSubmissionGuards` | Per-user report cooldown guard. |
| `CommentSubmissionGuards` | Per-user comment cooldown guard. |
| `ModerationLogs` | Server-created moderation audit records. |
| `DashboardData` | Latest weather and water level documents. |
| `DashboardData/{doc}/records` | Historical dashboard snapshots. |
| `EvacuationSites` | Map reference data for evacuation centers. |

### Realtime Listener Strategy

Firestore `onSnapshot` is used for live data. The application wraps listeners with `subscribeWithRetry`, which:

- Starts a listener.
- Calls the screen's error handler if Firestore reports an error.
- Unsubscribes the failed listener.
- Reconnects with exponential backoff and jitter.
- Cleans up retry timers when the screen unmounts.

This prevents long-running sessions from becoming permanently stale after transient network errors.

### Firestore Indexes

`firestore.indexes.json` defines composite indexes for common realtime queries:

| Query | Fields |
| --- | --- |
| User reports by time | `Reports.userId ASC`, `Reports.timestamp DESC` |
| Public notifications by time | `Notifications.audience ASC`, `Notifications.createdAt DESC` |
| User notifications by time | `Notifications.recipientId ASC`, `Notifications.createdAt DESC` |

These indexes support ordered feeds and avoid Firestore runtime index errors.

---

## Authentication System

Authentication is a hybrid backend-assisted Firebase Auth flow.

### Signup

1. User fills signup screens.
2. Frontend posts registration data to `/api/users/register`.
3. Backend validates required fields, email, username, and password strength.
4. Backend creates a Firebase Auth user with Admin SDK.
5. Backend writes the matching `Users/{uid}` Firestore profile document.
6. If profile write fails, backend deletes the Auth user to avoid orphaned accounts.

### Login

1. User enters email/username and password.
2. Backend resolves username to email if needed.
3. Backend calls Firebase Identity Toolkit password sign-in endpoint using `FIREBASE_WEB_API_KEY`.
4. Backend returns Firebase ID token, refresh token, expiry, role, username, and profile.
5. Frontend stores the session in React context.

### Firebase Client Session

The frontend cannot directly use the backend password session with Firestore. `ensureFirebaseSession` solves this:

```text
Backend ID token
  |
  v
POST /api/users/firebase-token
  |
  | Admin SDK createCustomToken(uid, role)
  v
Frontend signInWithCustomToken
  |
  v
Firebase Auth currentUser available for Firestore rules
```

This allows Firestore security rules to see `request.auth.uid` and custom role claims.

### Profile and Sensitive Changes

| Operation | Security Behavior |
| --- | --- |
| Profile update | Auth token required, backend validates and sanitizes fields. |
| Username update | Auth token required, username pattern enforced, uniqueness checked. |
| Password change | Auth token required, current password verified through Firebase Identity Toolkit before Admin SDK update. |
| Profile photo | Auth token required, Cloudinary asset ownership checked. |
| Logout | Firebase client sign-out, profile photo cache clear, session context reset. |

---

## Cloudinary Integration

Cloudinary is used instead of Firebase Storage for app media because it provides:

- Built-in image/video transformations.
- Efficient delivery through secure URLs.
- Format and quality optimization.
- Direct browser/mobile uploads using signed parameters.
- Admin API deletion by `public_id`.

### Upload Security

The frontend never receives the Cloudinary API secret. Instead:

1. Frontend sends upload metadata to backend:

```json
{
  "bytes": 123456,
  "folder": "reports/images",
  "mimeType": "image/jpeg",
  "resourceType": "image"
}
```

2. Backend validates:

- Firebase ID token.
- Allowed folder: `reports/images`, `reports/videos`, or `profiles`.
- Max image size: 8 MB.
- Max video size: 80 MB.
- MIME type matches resource type.

3. Backend signs Cloudinary params.
4. Frontend uploads directly to Cloudinary.
5. Frontend stores only returned metadata in Firestore.

### Media Types

| Use Case | Folder | Resource Type |
| --- | --- | --- |
| Report image | `reports/images/{uid}/...` | `image` |
| Report video | `reports/videos/{uid}/...` | `video` |
| Profile photo | `profiles/{uid}/...` | `image` |

### Optimization

`cloudinaryOptimizedUrl` rewrites URLs with transformation parameters such as:

```text
f_auto,q_auto:eco,c_limit,w_900
```

This keeps bandwidth low and improves image rendering performance. Videos use generated poster URLs for display previews.

### Cleanup

Cloud Functions clean up report media when reports are deleted or moderated out. When an owner deletes a report, Cloud Functions also remove the report's engagement subcollections and related notification documents. Profile photo replacement returns the previous `public_id`, and the frontend asks the backend to delete it.

---

## Map System

The map is implemented in `frontend/components/HazardMapView.tsx` using Leaflet inside a React Native WebView.

### Why Leaflet and OpenStreetMap

Leaflet/OpenStreetMap were chosen because:

- They work consistently through WebView on Expo-managed apps.
- OSM tiles avoid commercial mobile map SDK lock-in.
- Leaflet has mature marker clustering.
- It supports custom HTML/CSS markers and popups.

Tradeoffs:

- It depends on web assets loaded inside WebView.
- Native map gestures can feel different from native SDK maps.
- Offline maps are not built in.
- Heavy marker sets require clustering and careful update batching.

### Map Rendering Flow

```text
React Native props
  |
  | reports, evacuationSites, userLocation
  v
Serialize lightweight payload
  |
  v
Inject JavaScript into WebView
  |
  v
Leaflet updates markers/layers
  |
  v
WebView posts markerPress/mapPress messages back to React Native
```

### Map Features

- OSM light tiles and Carto dark tiles.
- Marker clustering via `leaflet.markercluster`.
- Hazard markers colored by severity.
- Evacuation site layer with custom pin SVG and labels at high zoom.
- User location dot and accuracy circle.
- Popup previews.
- React Native callback on marker press.
- Memoized HTML and map payloads to reduce rerenders.

### Coordinate Handling

Coordinates are validated before rendering:

- Latitude and longitude must be finite.
- Absolute latitude must be <= 90.
- Absolute longitude must be <= 180.

Report creation has stricter Marikina bounds validation:

```text
latitude:  14.57 to 14.72
longitude: 121.03 to 121.18
```

---

## Notification System

Notifications are stored in Firestore `Notifications` documents and displayed through realtime listeners.

### Notification Types

| Type | Created By | Audience |
| --- | --- | --- |
| `new_report` | Cloud Function `onReportCreated` | `all` |
| `official_alert` | Backend official alert service | `all` |
| `moderation_removed` | Cloud Function `onReportRemoved` | specific user |

### Notification Read State

Read/unread state is not stored on the notification itself. Instead, each user writes:

```text
NotificationReads/{userId}_{notificationId}
```

This avoids mutating shared notification documents and scales better when many users read the same alert.

### Notification Listener Flow

`subscribeToNotifications` listens to:

- Public notifications where `audience == "all"`.
- User notifications where `recipientId == userId`.
- `NotificationReads` for the current user.
- Reports in the selected date window to enrich notification cards with current report status.

It merges, deduplicates, filters, sorts, and emits the final notification list. The sort keeps the newest date buckets first in the order Today, Yesterday, This Week, This Month, This Year, then Older; priority fields such as severity, magnitude, and intensity are applied within the same bucket. When users select **This Year**, Firestore queries are bounded from January 1 of the current year onward so annual community and official alert history can be reviewed instead of only the newest page of notifications.

Official alerts are intentionally filtered so only actionable records surface to users: `official_alert` documents with `shouldNotify === false` are suppressed. The client keeps those alerts in the same date-bucket order as community notifications while still using stored severity, magnitude, and intensity to rank items inside each bucket.

### FCM Integration

Cloud Functions send an FCM topic message to `communityReports` when a new report is created. The in-app notification list, however, is primarily driven by Firestore realtime documents. This means the app can still show notifications even if push delivery is delayed or unavailable.

---

## Official Alert System

Official alerts are generated by backend services and written into the same `Notifications` collection as community notifications.

### Sources

| Source | Purpose | Poll Interval |
| --- | --- | --- |
| PAGASA cyclone data | Typhoon warnings | Default 30 minutes |
| PHIVOLCS latest earthquake page | Earthquake alerts | Default 5 minutes |
| Open-Meteo | Dashboard weather | Cached 10 minutes |
| BantayBaha/PANaHON/old FFWS | Water levels | Cached 5 minutes |

### Polling Architecture

`backend/services/officialAlertPoller.js` manages long-running pollers:

- Uses Axios with HTTP/HTTPS keep-alive agents.
- Applies request timeout.
- Tracks whether each source is currently running.
- Uses failure counters and backoff.
- Avoids overlapping polls.
- Stops timers on process shutdown.

### Deduplication

Official alert documents are deterministic:

```text
official_{officialAlertKey}_{officialEventId}
```

For latest alert streams, each source event uses a deterministic document id so duplicate polls update the same notification while separate events remain available for annual review. The backend also prunes official alerts older than the current year, keeping the active Firestore history aligned to the current annual period.

Each official alert stores normalized `severity`, `signalLevel`, `magnitude`, `intensity`, and `shouldNotify` metadata so the UI can render the correct urgency and hide non-actionable advisories.

PAGASA typhoon alerts are skipped when no active cyclone feed record is available, and active alerts include the local Marikina Tropical Cyclone Wind Signal level inside the alert body. PHIVOLCS earthquake alerts include magnitude/intensity context for Marikina monitoring.

### Manual Official Alerts

`POST /api/alerts/official` supports manual official alert creation. It requires either:

- `x-official-alert-key` matching `OFFICIAL_ALERT_API_KEY`, or
- an authenticated user whose `Users/{uid}.role` is `admin`, `official`, or `responder`.

---

## Realtime System

BantayMarikina uses Firestore realtime listeners rather than a custom WebSocket server.

### Realtime Design Principles

- Use Firestore as the source of truth.
- Keep client writes narrow and user-owned.
- Use Cloud Functions for trusted aggregation.
- Stop listeners when app is backgrounded.
- Retry listener failures with exponential backoff.
- Hash emitted data to avoid redundant UI updates.

### Listener Cleanup

Hooks use `useEffect` cleanup functions and `AppState` listeners:

```text
App active    -> ensure Firebase session -> start onSnapshot
App inactive  -> unsubscribe
Unmount       -> remove AppState listener and unsubscribe
```

This reduces battery use, memory leaks, and unnecessary Firestore reads.

### Reconnect Handling

`subscribeWithRetry` wraps Firestore listeners. On listener failure, it:

1. Emits the error.
2. Unsubscribes the failed listener.
3. Schedules a reconnect.
4. Increases retry delay up to 30 seconds.
5. Adds jitter to avoid synchronized retry spikes.

---

## Social Interaction System

Social interactions are stored as subcollections under each report.

### Likes

```text
Reports/{reportId}/likes/{userId}
```

A user can create or delete only their own like document. Cloud Functions increment/decrement `Reports/{reportId}.likeCount`.

### Comments

```text
Reports/{reportId}/comments/{commentId}
```

Comments include:

- `userId`
- `userName`
- `userPhotoUrl`
- `body`
- `createdAt`

The frontend writes a comment and updates `CommentSubmissionGuards/{userId}` in the same batch. Firestore rules use this guard for lightweight anti-spam. Cloud Functions update `commentCount`.

### Views

```text
Reports/{reportId}/userViews/{userId}
```

Each user can create one view document per report. Cloud Functions increment `viewCount`.

### Community Reporting and Moderation

```text
Reports/{reportId}/userReports/{userId}
```

Allowed categories:

- `false_report`
- `inaccurate_image`
- `misleading_information`
- `spam`
- `other`

When a user flags a report, Cloud Functions:

1. Reads the current report.
2. Updates category counts.
3. Increments `userReportCount`.
4. Computes the dominant category.
5. Auto-removes the report when five different users have flagged it.
6. Stores the dominant category as `removedReason`.
7. Writes a moderation log.
8. Lets `onReportRemoved` notify the original reporter with an `ADMIN/OFFICIAL` label and the removal reason/category.

This keeps moderation-sensitive state out of direct client control.

---

## Security Architecture

Security is layered across frontend validation, backend validation, Firestore rules, Cloud Functions, and environment separation.

### Firestore Rules

`firestore.rules` enforces:

- Signed-in users only for report and notification reads.
- Owner-only report creation.
- Owner-only report deletion, with trusted Cloud Functions cleanup for report subcollections and related notifications.
- Marikina coordinate bounds.
- Allowed hazard types and severities aligned with the frontend report form.
- Strict report schema.
- Owner-only likes, views, comments, and userReports.
- User flag documents are one per user per report, and users cannot flag their own reports.
- No client writes to notification documents except admin roles.
- No client writes to moderation logs except admin roles.
- User profile reads restricted to owner.
- Profile photo URL restricted to Cloudinary URLs.
- Report/comment cooldown guard validation.

### Storage Rules

`storage.rules` provides:

- Authenticated reads.
- Owner-only writes/deletes under user-specific paths.
- Image-only uploads for Firebase Storage paths.
- 8 MB max size.
- Default deny fallback.

Current media storage primarily uses Cloudinary, but Firebase Storage remains protected if used later.

### Backend Protections

The Express backend includes:

- `helmet`-like behavior by disabling `x-powered-by`.
- JSON body limit of 1 MB.
- Request and response timeouts.
- CORS configuration through `CORS_ORIGIN`.
- Lightweight in-memory rate limiting.
- Firebase ID token verification.
- Input sanitization.
- External API request retries and timeouts.
- Safe public error messages with internal logging.

### Cloudinary Security

- Cloudinary API secret is backend-only.
- Upload signatures require authentication.
- Allowed folders are whitelisted.
- File size and MIME type are validated.
- Profile media must belong to the authenticated user's Cloudinary path.
- Media deletion is limited to owned paths.

### Anti-Spam

| Feature | Protection |
| --- | --- |
| Report submissions | Local cooldown plus Firestore `ReportSubmissionGuards`. |
| Comments | Firestore `CommentSubmissionGuards`. |
| Auth attempts | Backend rate limiter. |
| Cloudinary signing | Backend rate limiter. |
| Official alerts | Role/API key check plus route limiter. |
| Likes/views | One document per user per report. |

---

## Performance Optimization

### Frontend

- Firestore listeners are stopped when the app is backgrounded.
- Reports and notifications use query limits.
- Notification lists use `FlatList` virtualization.
- Map payloads are memoized and injected into an existing WebView instead of rebuilding the entire React Native screen.
- Cloudinary serves optimized media.
- The dashboard service shares listeners and cached snapshots.
- Reanimated is used for small UI transitions without heavy rerender loops.

### Backend

- Axios clients use keep-alive agents.
- External API fetches use timeouts and retries.
- Dashboard refreshes deduplicate concurrent refresh promises.
- Dashboard data is cached in Firestore with TTL logic.
- Pollers prevent overlapping runs.
- Server starts listening before cache warmup finishes, avoiding startup 503 behavior.
- Cron jobs refresh weather every 10 minutes and water levels every 5 minutes.

### Realtime Cost Control

- `limit()` is used for report and notification queries.
- Engagement data subscribes only when a report is selected.
- Notification read state is separate from shared notification docs.
- Dashboard data has latest-doc listeners rather than repeatedly querying history.

---

## File and Folder Structure

```text
Database Sytem Project/
  backend/
  docs/
  frontend/
  functions/
  scripts/
  firebase.json
  firestore.rules
  firestore.indexes.json
  storage.rules
```

### Root Files

| File | Purpose |
| --- | --- |
| `firebase.json` | Declares Firebase Functions source, Firestore rules/indexes, and Storage rules. |
| `firestore.rules` | Data access and validation policy for Firestore. |
| `firestore.indexes.json` | Composite indexes for Firestore queries. |
| `storage.rules` | Firebase Storage access policy. |
| `.firebaserc` | Firebase project binding. |
| `.gitignore` | Prevents committing env files, service account keys, logs, PIDs, and node_modules. |

### Frontend

```text
frontend/
  app/
  components/
  config/
  constants/
  context/
  hooks/
  services/
  theme/
  types/
  assets/
```

| Path | Purpose |
| --- | --- |
| `frontend/app/` | Expo Router screens and root layout. |
| `frontend/app/_layout.tsx` | Providers, Stack setup, bottom navigation visibility, transition animation. |
| `frontend/app/home.tsx` | Main dashboard. |
| `frontend/app/map.tsx` | Full map and filters. |
| `frontend/app/report.tsx` | Hazard submission flow. |
| `frontend/app/notification.tsx` | Realtime notification center. |
| `frontend/app/profile.tsx` | Profile, username, password, photo, logout. |
| `frontend/app/hotline.tsx` | Emergency hotline view. |
| `frontend/app/signup/` | Multi-step signup flow. |
| `frontend/components/` | Reusable UI and feature components. |
| `frontend/components/HazardMapView.tsx` | Leaflet/WebView map renderer. |
| `frontend/components/HazardDetailsSheet.tsx` | Selected report details and engagement UI. |
| `frontend/components/ReportFilterBar.tsx` | Shared filter controls. |
| `frontend/components/BottomNav.tsx` | Main route navigation bar. |
| `frontend/config/firebase.ts` | Firebase client initialization. |
| `frontend/context/auth-context.tsx` | Auth session provider. |
| `frontend/context/signup-context.tsx` | Signup draft state provider. |
| `frontend/hooks/` | Realtime and device integration hooks. |
| `frontend/services/` | API, Firebase, Cloudinary, dashboard, navigation, realtime modules. |
| `frontend/theme/` | Colors, spacing, typography, provider, dark mode. |
| `frontend/types/` | Domain types for hazards and evacuation sites. |
| `frontend/assets/` | Icons, logos, static images. |

### Backend

```text
backend/
  index.js
  firebase.js
  middleware/
  routes/
  services/
  scripts/
```

| Path | Purpose |
| --- | --- |
| `backend/index.js` | Express app, middleware, routes, cron jobs, process lifecycle. |
| `backend/firebase.js` | Firebase Admin initialization from service account. |
| `backend/middleware/security.js` | Rate limiter, text sanitization, email validation. |
| `backend/routes/users.js` | Auth, profile, username, password endpoints. |
| `backend/routes/media.js` | Cloudinary signing, deletion, profile photo endpoints. |
| `backend/routes/reports.js` | Backend report API, protected by Firebase token. |
| `backend/routes/weather.js` | Cached weather endpoint. |
| `backend/routes/waterlevel.js` | Cached water level endpoint. |
| `backend/routes/alerts.js` | Official alert creation endpoint. |
| `backend/services/dashboardCache.js` | External data cache and Firestore dashboard writes. |
| `backend/services/officialAlertPoller.js` | PAGASA/PHIVOLCS pollers. |
| `backend/services/officialAlerts.js` | Official notification normalization and deduplication. |
| `backend/scripts/` | Seed and tunnel helper scripts. |

### Cloud Functions

```text
functions/
  index.js
  package.json
```

Cloud Functions handle trusted Firestore side effects:

- Community report notification creation.
- FCM topic send.
- Like/comment/view counters.
- Community moderation aggregation.
- Moderation notifications.
- Cloudinary cleanup for removed/deleted reports.

---

## Database Schema

### `Users/{uid}`

```ts
{
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  gender?: string;
  contact_number?: string;
  email: string;
  email_lower: string;
  username: string;
  username_lower: string;
  role: 'resident' | 'admin' | 'official' | 'responder' | string;
  name: {
    first: string;
    middle?: string;
    last: string;
    suffix?: string;
    full: string;
  };
  address: {
    barangay?: string;
    street_block?: string;
    house_number?: string;
  };
  photoURL?: string;
  profilePhotoUrl?: string;
  profile_photo_url?: string;
  profilePhotoMedia?: CloudinaryMedia;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### `Reports/{reportId}`

```ts
{
  title: string;
  hazardType: string;
  hazard_type: string;
  description: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  severity: 'Low' | 'Moderate' | 'High' | 'Critical';
  barangay?: string;
  userId: string;
  sender_id: string;
  reporterName?: string;
  reporterPhotoUrl?: string;
  imageUrl?: string | null;
  image_url?: string | null;
  cloudinaryMedia?: CloudinaryMedia;
  media?: CloudinaryMedia[];
  capturedAtLabel?: string;
  source: 'community';
  moderationStatus: 'visible' | 'removed';
  likeCount: number;
  commentCount: number;
  viewCount: number;
  userReportCount: number;
  reportCategoryCounts?: Record<string, number>;
  removedReason?: string | null;
  status: 'active' | 'pending' | 'resolved' | 'rejected';
  timestamp: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `Notifications/{notificationId}`

```ts
{
  audience: 'all' | 'user';
  recipientId?: string;
  type: 'new_report' | 'official_alert' | 'moderation_removed';
  reportId?: string;
  title: string;
  body: string;
  hazardType?: string;
  severity?: string;
  source?: 'official' | 'community' | 'admin';
  sourceLabel?: string;
  priority?: 'normal' | 'high' | 'critical';
  safetyTip?: string;
  affectedArea?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  barangay?: string;
  reporterName?: string;
  provider?: string;
  providerReference?: string | null;
  officialAlertKey?: string | null;
  officialEventId?: string | null;
  sourceUrl?: string | null;
  createdAt: Timestamp;
  issuedAt?: Timestamp | null;
  updatedAt?: Timestamp;
}
```

### Dashboard Documents

```text
DashboardData/weather
DashboardData/waterlevel
DashboardData/weather/records/{recordId}
DashboardData/waterlevel/records/{recordId}
```

Latest documents are used for realtime UI. Records are used for historical source snapshots and diagnostics.

---

## API and Backend Flow

### Express App Lifecycle

`backend/index.js`:

1. Loads environment variables.
2. Creates Express app.
3. Configures CORS, JSON body limit, rate limiting, timeouts.
4. Mounts routes under `/api`.
5. Starts server listener.
6. Warms dashboard cache asynchronously.
7. Starts official alert polling.
8. Schedules weather and water refresh cron jobs.
9. Handles SIGTERM/SIGINT by stopping pollers and closing server.

### API Routes

| Route | Purpose |
| --- | --- |
| `GET /health` | Basic process health. |
| `POST /api/users/register` | Signup. |
| `POST /api/users/login` | Password login by email or username. |
| `POST /api/users/firebase-token` | Create Firebase custom token. |
| `GET /api/users/me` | Current profile. |
| `PATCH /api/users/me` | Profile update. |
| `PATCH /api/users/me/username` | Username update. |
| `PATCH /api/users/me/password` | Password change with current password verification. |
| `POST /api/users/forgot-password` | Firebase password reset email. |
| `POST /api/media/cloudinary/sign-upload` | Signed Cloudinary upload params. |
| `POST /api/media/cloudinary/delete` | Delete owned Cloudinary media. |
| `POST /api/media/cloudinary/profile-photo` | Save profile photo metadata. |
| `DELETE /api/media/cloudinary/profile-photo` | Remove profile photo metadata. |
| `GET /api/weather` | Cached weather data. |
| `GET /api/waterlevel` | Cached water level data. |
| `POST /api/alerts/official` | Create official alert. |
| `GET/POST /api/reports` | Backend report API, authenticated. |

### Cloud Functions

| Function | Trigger | Purpose |
| --- | --- | --- |
| `onReportCreated` | `Reports/{reportId}` create | Create notification and send FCM topic. |
| `onReportRemoved` | `Reports/{reportId}` update | Clean report media and notify reporter. |
| `onReportDeleted` | `Reports/{reportId}` delete | Clean report media, engagement subcollections, and report notifications. |
| `onReportLikeCreated/Deleted` | likes subcollection | Maintain `likeCount`. |
| `onReportCommentCreated/Deleted` | comments subcollection | Maintain `commentCount`. |
| `onReportViewCreated` | userViews subcollection | Maintain `viewCount`. |
| `onUserReportCreated` | userReports subcollection | Aggregate moderation and auto-remove if needed. |

---

## Error Handling and Stability

### Frontend

- User-facing errors are short and actionable.
- Realtime hooks expose `error` state to screens.
- `subscribeWithRetry` recovers from listener failures.
- Location and upload flows catch and display errors without crashing.
- Map WebView messages are parsed defensively.

### Backend

- Global handlers log unhandled rejections and uncaught exceptions.
- External API calls use timeouts and retry only retryable status codes.
- Dashboard cache falls back to stale data or unavailable placeholder data.
- Server starts before cache warmup to avoid startup downtime.
- Official pollers back off after failures.
- Cloudinary delete retries transient failures.

### 503 Prevention Strategy

The project avoids recurring 503 instability by:

- Not blocking server startup on external API success.
- Caching dashboard data in Firestore.
- Deduplicating concurrent refreshes.
- Using keep-alive connections.
- Adding timeouts to external calls.
- Limiting request sizes and rates.
- Returning stale/fallback data instead of crashing.

---

## Deployment and Development

### Local Development

Install dependencies at root and in subprojects:

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
npm --prefix functions install
```

Run backend:

```bash
npm --prefix backend run dev
```

Run frontend:

```bash
npm --prefix frontend start
```

For Android emulator, the frontend can infer `http://10.0.2.2:3000/api` when no Expo host is available. LAN/tunnel scripts are provided for device testing.

### Environment Variables

#### Backend

```env
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:8081,http://localhost:19006
FIREBASE_WEB_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OFFICIAL_ALERT_API_KEY=...
```

Backend secrets must never be placed in frontend `.env` files.

#### Frontend

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000/api
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Firebase web config values are public identifiers, not service account credentials. Security is enforced by Auth and Firestore rules.

### Firebase Deployment

Deploy rules and functions together when changing trusted write flows:

```bash
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

### Production Considerations

- Use Firebase/Google Cloud Secret Manager or environment config for secrets.
- Use HTTPS for backend API.
- Set strict `CORS_ORIGIN`.
- Rotate service account keys if exposed.
- Monitor Cloud Functions logs.
- Configure Firebase Auth authorized domains.
- Set Cloudinary upload limits and review account-level security settings.

---

## Future Scalability

### Current Strengths

- Firestore handles realtime fanout without a custom WebSocket layer.
- Cloud Functions own counter and moderation aggregation.
- Cloudinary keeps media delivery optimized.
- Backend cache protects external data sources.
- Listeners are bounded and cleaned up.

### Known Limits

| Area | Limitation |
| --- | --- |
| Firestore report feed | Current queries pull newest reports and filter some fields client-side. |
| Moderation rule | Auto-removal uses a fixed five-unique-user threshold and may need stronger trust modeling. |
| In-memory rate limiting | Works for one backend instance but does not coordinate across multiple instances. |
| Leaflet WebView | Very high marker counts may require server-side tiling or viewport queries. |
| Official source scraping | HTML/source changes can break parsers. |

### Recommended Future Improvements

- Move high-volume filtering to Firestore queries with additional composite indexes.
- Add geohash-based viewport queries for map scale.
- Replace in-memory rate limiting with Redis or Cloud Memorystore if backend scales horizontally.
- Add FCM device token registration and per-user push topics.
- Add admin moderation dashboard.
- Add App Check for Firebase and backend endpoints.
- Add automated Firebase rules tests.
- Add observability dashboards for listener errors, function failures, upload failures, and source polling.
- Add offline-first cache behavior for critical safety tips and evacuation sites.
- Add audit trails for admin actions and official alert edits.

---

## Summary

BantayMarikina is a mobile-first realtime disaster monitoring system built around Firebase synchronization, an Expo frontend, an Express backend, Cloudinary media, and trusted Cloud Functions side effects. The architecture separates responsibilities cleanly:

- The frontend owns UX, local validation, and realtime rendering.
- Firestore owns realtime state.
- Backend owns secrets, external integrations, and protected APIs.
- Cloud Functions own trusted data side effects.
- Cloudinary owns media delivery and optimization.

This design keeps the app responsive and practical while preserving security boundaries around sensitive writes, media uploads, authentication, moderation, and official alert generation.
