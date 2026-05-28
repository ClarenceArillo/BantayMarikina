import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  runTransaction,
  setDoc,
  writeBatch,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { getFirebaseClients } from '@/config/firebase';
import { deleteCloudinaryMedia, uploadToCloudinary, cloudinaryOptimizedUrl, cloudinaryTimestampUrl, cloudinaryVideoPosterUrl } from '@/services/cloudinaryService';
import { subscribeWithRetry } from '@/services/realtime';
import type {
  HazardReport,
  HazardReportInput,
  ReportComment,
  ReportEngagement,
  ReportFilters,
  ReportModerationCategory,
  ReportNotification,
} from '@/types/hazard';

const REPORTS_COLLECTION = 'Reports';
const NOTIFICATIONS_COLLECTION = 'Notifications';
const NOTIFICATION_READS_COLLECTION = 'NotificationReads';
const REPORT_SUBMISSION_GUARDS_COLLECTION = 'ReportSubmissionGuards';
const COMMENT_SUBMISSION_GUARDS_COLLECTION = 'CommentSubmissionGuards';
const MARIKINA_BOUNDS = {
  minLat: 14.57,
  maxLat: 14.72,
  minLng: 121.03,
  maxLng: 121.18,
};
const RECENT_REPORT_COOLDOWN_MS = 60_000;
const recentSubmitChecks = new Map<string, number>();
const engagementWriteLocks = new Map<string, Promise<void>>();

function logReportTrace(message: string, meta: Record<string, unknown> = {}) {
  console.log('[hazard-report-submit]', message, {
    at: new Date().toISOString(),
    ...meta,
  });
}

function summarizeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return 'timestamp';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(summarizeValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      key.toLowerCase().includes('token') ? '[redacted]' : summarizeValue(item),
    ])
  );
}

function summarizePayload(payload: Record<string, unknown>) {
  return {
    keys: Object.keys(payload).sort(),
    data: summarizeValue(payload),
  };
}

function isFirestoreErrorCode(error: unknown, code: string) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === code;
}

function ignoreAlreadyExists(error: unknown) {
  if (!isFirestoreErrorCode(error, 'already-exists')) throw error;
}

function runLockedEngagementWrite(key: string, write: () => Promise<void>) {
  const activeWrite = engagementWriteLocks.get(key);
  if (activeWrite) return activeWrite;

  const nextWrite = write().finally(() => {
    if (engagementWriteLocks.get(key) === nextWrite) {
      engagementWriteLocks.delete(key);
    }
  });
  engagementWriteLocks.set(key, nextWrite);
  return nextWrite;
}

function getCurrentFirebaseUid(fallbackUserId?: string) {
  const { auth } = getFirebaseClients();
  const firebaseUid = auth.currentUser?.uid || fallbackUserId;

  if (!firebaseUid) {
    throw new Error('Please sign in before using post engagement.');
  }

  return firebaseUid;
}

function getAuthoritativeFirebaseUid(callerUserId?: string) {
  const { auth } = getFirebaseClients();
  const firebaseUid = auth.currentUser?.uid;

  if (!firebaseUid) {
    throw new Error('Please sign in before submitting or managing hazard reports.');
  }

  if (callerUserId && callerUserId !== firebaseUid) {
    throw new Error('Your Firebase session does not match the signed-in app user. Please sign out, sign in again, and retry.');
  }

  return firebaseUid;
}

function sanitizeText(value: string, maxLength: number) {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedFields(item)) as T;
  }

  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || value instanceof Timestamp) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedFields(item)])
  ) as T;
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const timestampLike = value as { seconds?: unknown; _seconds?: unknown; nanoseconds?: unknown; _nanoseconds?: unknown; toDate?: unknown };
    if (typeof timestampLike.toDate === 'function') {
      const date = timestampLike.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }

    const seconds = typeof timestampLike.seconds === 'number' ? timestampLike.seconds : timestampLike._seconds;
    const nanoseconds = typeof timestampLike.nanoseconds === 'number' ? timestampLike.nanoseconds : timestampLike._nanoseconds;
    if (typeof seconds === 'number') {
      const date = new Date((seconds * 1000) + (typeof nanoseconds === 'number' ? Math.floor(nanoseconds / 1_000_000) : 0));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function getCoordinate(data: DocumentData, key: 'latitude' | 'longitude') {
  if (typeof data[key] === 'number') return data[key];
  if (key === 'latitude' && typeof data.location?.latitude === 'number') return data.location.latitude;
  if (key === 'longitude' && typeof data.location?.longitude === 'number') return data.location.longitude;
  return null;
}

function normalizeReport(doc: QueryDocumentSnapshot<DocumentData>): HazardReport | null {
  const data = doc.data();
  const latitude = getCoordinate(data, 'latitude');
  const longitude = getCoordinate(data, 'longitude');

  if (latitude === null || longitude === null) return null;

  const media = data.media || (data.cloudinaryMedia ? [data.cloudinaryMedia] : []);
  const firstMedia = media[0];
  const capturedAtLabel = data.capturedAtLabel || data.captured_at_label || '';
  const mediaUrl = firstMedia?.secure_url || data.imageUrl || data.image_url;

  return {
    id: doc.id,
    title: data.title || data.headline || data.hazardType || data.hazard_type || 'Community report',
    hazardType: data.hazardType || data.hazard_type || 'Others',
    description: data.description || '',
    latitude,
    longitude,
    timestamp: toDate(data.timestamp || data.createdAt || data.created_at || data.updatedAt),
    userId: data.userId || data.sender_id,
    reporterName: data.reporterName,
    severity: data.severity,
    barangay: data.barangay,
    imageUrl: firstMedia?.resource_type === 'video'
      ? cloudinaryTimestampUrl(cloudinaryVideoPosterUrl(mediaUrl), capturedAtLabel)
      : cloudinaryTimestampUrl(cloudinaryOptimizedUrl(mediaUrl), capturedAtLabel),
    media,
    capturedAtLabel,
    reporterPhotoUrl: cloudinaryOptimizedUrl(data.reporterPhotoUrl || data.reporter_photo_url || data.userPhotoUrl, 160),
    status: data.status || 'active',
    source: data.source || 'community',
    moderationStatus: data.moderationStatus || (data.status === 'rejected' ? 'removed' : 'visible'),
    magnitude: typeof data.magnitude === 'number' ? data.magnitude : Number.isFinite(Number(data.magnitude)) ? Number(data.magnitude) : undefined,
    intensity: typeof data.intensity === 'number' ? data.intensity : Number.isFinite(Number(data.intensity)) ? Number(data.intensity) : undefined,
    signalLevel: typeof data.signalLevel === 'number' ? data.signalLevel : Number.isFinite(Number(data.signalLevel)) ? Number(data.signalLevel) : undefined,
    shouldNotify: typeof data.shouldNotify === 'boolean' ? data.shouldNotify : undefined,
    likeCount: data.likeCount || 0,
    commentCount: data.commentCount || 0,
    viewCount: data.viewCount || 0,
    userReportCount: data.userReportCount || 0,
    accuracyMeters: data.accuracyMeters ?? null,
  };
}

function normalizeComment(doc: QueryDocumentSnapshot<DocumentData>): ReportComment {
  const data = doc.data();

  return {
    id: doc.id,
    userId: data.userId || '',
    userName: data.userName || 'Resident',
    userPhotoUrl: cloudinaryOptimizedUrl(data.userPhotoUrl, 96),
    body: data.body || '',
    createdAt: toDate(data.createdAt || data.created_at || data.timestamp),
  };
}

function normalizeNotification(
  doc: QueryDocumentSnapshot<DocumentData>,
  readIds: Set<string>,
  report?: HazardReport | null
): ReportNotification {
  const data = doc.data();
  const magnitude = typeof data.magnitude === 'number' ? data.magnitude : Number.isFinite(Number(data.magnitude)) ? Number(data.magnitude) : undefined;
  const intensity = typeof data.intensity === 'number' ? data.intensity : Number.isFinite(Number(data.intensity)) ? Number(data.intensity) : undefined;
  const signalLevel = typeof data.signalLevel === 'number' ? data.signalLevel : Number.isFinite(Number(data.signalLevel)) ? Number(data.signalLevel) : undefined;

  return {
    id: doc.id,
    reportId: data.reportId,
    recipientId: data.recipientId ?? null,
    audience: data.audience || (data.recipientId ? 'user' : 'all'),
    type: data.type || 'new_report',
    title: data.title || 'Community report',
    body: data.body || '',
    hazardType: data.hazardType,
    severity: data.severity,
    source: data.source || (data.type === 'official_alert' ? 'official' : 'community'),
    sourceLabel: data.sourceLabel || data.source_label || (data.type === 'official_alert' ? 'OFFICIAL ALERT' : undefined),
    safetyTip: data.safetyTip || data.safety_tip,
    affectedArea: data.affectedArea || data.affected_area || data.barangay,
    priority: data.priority || (data.type === 'official_alert' ? 'high' : 'normal'),
    magnitude,
    intensity,
    signalLevel,
    shouldNotify: typeof data.shouldNotify === 'boolean' ? data.shouldNotify : undefined,
    imageUrl: data.imageUrl,
    capturedAtLabel: data.capturedAtLabel || data.captured_at_label || report?.capturedAtLabel,
    latitude: data.latitude,
    longitude: data.longitude,
    barangay: data.barangay,
    reporterName: data.reporterName,
    moderationReason: data.moderationReason,
    moderationReasonLabel: data.moderationReasonLabel,
    createdAt: toDate(data.createdAt),
    read: readIds.has(doc.id),
    report,
  };
}

function getDateWindow(filters?: ReportFilters) {
  const now = new Date();
  const start = new Date(now);

  if (!filters || filters.dateRange === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end: null };
  }

  if (filters.dateRange === 'today') {
    start.setHours(0, 0, 0, 0);
    return { start, end: null };
  }

  if (filters.dateRange === 'yesterday') {
    const end = new Date(start);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (filters.dateRange === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end: null };
  }

  if (filters.dateRange === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { start, end: null };
  }

  return {
    start: filters.customStart || null,
    end: filters.customEnd || null,
  };
}

function buildTimeBoundQueryConstraints(
  dateField: string,
  filters: ReportFilters | undefined,
  maxItems: number,
  includeLimit = true
) {
  const window = getDateWindow(filters);
  const constraints: QueryConstraint[] = [];

  if (window.start) constraints.push(where(dateField, '>=', Timestamp.fromDate(window.start)));
  if (window.end) constraints.push(where(dateField, '<=', Timestamp.fromDate(window.end)));
  constraints.push(orderBy(dateField, 'desc'));

  if (includeLimit && filters?.dateRange !== 'year') {
    constraints.push(limit(maxItems));
  }

  return constraints;
}

function matchesFilters(report: HazardReport, filters?: ReportFilters) {
  if (report.status === 'rejected' || report.moderationStatus === 'removed') return false;

  const window = getDateWindow(filters);
  const timestamp = report.timestamp?.getTime();

  if (window.start && timestamp && timestamp < window.start.getTime()) return false;
  if (window.end && timestamp && timestamp > window.end.getTime()) return false;
  if (filters?.hazardType && filters.hazardType !== 'All' && report.hazardType !== filters.hazardType) return false;
  if (filters?.severity && filters.severity !== 'All' && report.severity !== filters.severity) return false;
  if (filters?.status && filters.status !== 'All' && report.status !== filters.status) return false;
  if (filters?.source && filters.source !== 'All' && report.source !== filters.source) return false;

  return true;
}

function severityRank(severity?: string) {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return 4;
  if (normalized === 'high') return 3;
  if (normalized === 'moderate') return 2;
  if (normalized === 'low') return 1;
  return 0;
}

function sortNotifications(a: ReportNotification, b: ReportNotification) {
  const severityDiff = severityRank(b.severity) - severityRank(a.severity);
  if (severityDiff !== 0) return severityDiff;

  const magnitudeDiff = (Number(b.magnitude) || 0) - (Number(a.magnitude) || 0);
  if (magnitudeDiff !== 0) return magnitudeDiff;

  const intensityDiff = (Number(b.signalLevel ?? b.intensity) || 0) - (Number(a.signalLevel ?? a.intensity) || 0);
  if (intensityDiff !== 0) return intensityDiff;

  return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
}

function matchesNotificationFilters(notification: ReportNotification, filters?: ReportFilters) {
  if (!filters) return true;

  const window = getDateWindow(filters);
  const createdAt = notification.createdAt?.getTime();

  if (window.start && createdAt && createdAt < window.start.getTime()) return false;
  if (window.end && createdAt && createdAt > window.end.getTime()) return false;

  if (filters.source && filters.source !== 'All') {
    const source = notification.source === 'admin' ? 'official' : notification.source || notification.report?.source || 'community';
    if (source !== filters.source) return false;
  }

  if (filters.hazardType && filters.hazardType !== 'All' && notification.hazardType !== filters.hazardType && notification.report?.hazardType !== filters.hazardType) return false;
  if (filters.severity && filters.severity !== 'All' && notification.severity !== filters.severity && notification.report?.severity !== filters.severity) return false;

  return true;
}

export function isInsideMarikina(latitude: number, longitude: number) {
  return (
    latitude >= MARIKINA_BOUNDS.minLat &&
    latitude <= MARIKINA_BOUNDS.maxLat &&
    longitude >= MARIKINA_BOUNDS.minLng &&
    longitude <= MARIKINA_BOUNDS.maxLng
  );
}

export function validateHazardReport(input: HazardReportInput) {
  const description = sanitizeText(input.description, 240);

  if (!description || description.length < 8) {
    throw new Error('Please add a short description with at least 8 characters.');
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('GPS location is not available yet.');
  }

  if (!isInsideMarikina(input.latitude, input.longitude)) {
    throw new Error('Reports are currently limited to Marikina City.');
  }
}

export async function submitHazardReport(input: HazardReportInput) {
  validateHazardReport(input);

  const { auth, db } = getFirebaseClients();
  const authoritativeUserId = getAuthoritativeFirebaseUid(input.userId);
  await auth.currentUser?.getIdToken(true).catch((error) => {
    logReportTrace('unable to force-refresh Firebase token before submit', {
      firebaseUid: auth.currentUser?.uid || null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });
  const firebaseTokenResult = await auth.currentUser?.getIdTokenResult().catch((error) => {
    logReportTrace('unable to read Firebase token before submit', {
      firebaseUid: auth.currentUser?.uid || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  const lastLocalSubmitAt = recentSubmitChecks.get(authoritativeUserId) || 0;
  if (Date.now() - lastLocalSubmitAt < RECENT_REPORT_COOLDOWN_MS) {
    throw new Error('Please wait a minute before submitting another report.');
  }

  let lastReportAt: Date | null = null;
  try {
    const guardSnapshot = await getDoc(doc(db, REPORT_SUBMISSION_GUARDS_COLLECTION, authoritativeUserId));
    lastReportAt = guardSnapshot.exists()
      ? toDate(guardSnapshot.data().lastSubmittedAt || guardSnapshot.data().updatedAt)
      : null;
    logReportTrace('loaded report submission guard', {
      path: `${REPORT_SUBMISSION_GUARDS_COLLECTION}/${authoritativeUserId}`,
      exists: guardSnapshot.exists(),
      guardKeys: guardSnapshot.exists() ? Object.keys(guardSnapshot.data()).sort() : [],
      lastReportAt: lastReportAt?.toISOString() || null,
    });
  } catch {
    logReportTrace('unable to read report submission guard; relying on server rules', {
      path: `${REPORT_SUBMISSION_GUARDS_COLLECTION}/${authoritativeUserId}`,
    });
    // Guard reads are a throttle optimization. Server rules still enforce the cooldown.
  }

  if (lastReportAt && Date.now() - lastReportAt.getTime() < RECENT_REPORT_COOLDOWN_MS) {
    recentSubmitChecks.set(authoritativeUserId, lastReportAt.getTime());
    throw new Error('Please wait a minute before submitting another report.');
  }

  const mediaResourceType = input.mediaType === 'video' ? 'video' : 'image';
  const cloudinaryMedia = input.imageUri && input.idToken
    ? await uploadToCloudinary({
        folder: mediaResourceType === 'video' ? 'reports/videos' : 'reports/images',
        idToken: input.idToken,
        mediaUri: input.imageUri,
        mediaSizeBytes: input.mediaSizeBytes,
        onProgress: input.onUploadProgress,
        resourceType: mediaResourceType,
      })
    : null;
  const safeCloudinaryMedia = cloudinaryMedia
    ? stripUndefinedFields(cloudinaryMedia)
    : null;
  const imageUrl = cloudinaryMedia?.secure_url || null;
  const title = `${input.severity} ${input.hazardType}`;
  const cleanDescription = sanitizeText(input.description, 240);

  try {
    const reportRef = doc(collection(db, REPORTS_COLLECTION));
    const reportPayload = stripUndefinedFields({
    title,
    hazardType: input.hazardType,
    hazard_type: input.hazardType,
    description: cleanDescription,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters ?? null,
    severity: input.severity,
    barangay: input.barangay || '',
    userId: authoritativeUserId,
    sender_id: authoritativeUserId,
    reporterName: input.reporterName || '',
    reporterPhotoUrl: input.reporterPhotoUrl || '',
    reporter_photo_url: input.reporterPhotoUrl || '',
    imageUrl,
    image_url: imageUrl,
    cloudinaryMedia: safeCloudinaryMedia,
    media: safeCloudinaryMedia ? [safeCloudinaryMedia] : [],
    capturedAtLabel: input.capturedAtLabel || '',
    source: 'community',
    moderationStatus: 'visible',
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    userReportCount: 0,
    status: 'active',
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    });
    const guardRef = doc(db, REPORT_SUBMISSION_GUARDS_COLLECTION, authoritativeUserId);
    const guardPayload = {
      lastReportId: reportRef.id,
      lastSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userId: authoritativeUserId,
    };
    const batch = writeBatch(db);

    logReportTrace('committing report batch', {
      authUid: auth.currentUser?.uid || null,
      callerUserId: input.userId || null,
      firebaseTokenExpirationTime: firebaseTokenResult?.expirationTime || null,
      firebaseTokenIssuedAtTime: firebaseTokenResult?.issuedAtTime || null,
      reportPath: `${REPORTS_COLLECTION}/${reportRef.id}`,
      guardPath: `${REPORT_SUBMISSION_GUARDS_COLLECTION}/${authoritativeUserId}`,
      ruleExpectations: {
        signedIn: Boolean(auth.currentUser),
        userMatchesAuth: auth.currentUser?.uid === authoritativeUserId,
        senderMatchesUser: reportPayload.sender_id === reportPayload.userId,
        guardLastReportMatchesReport: guardPayload.lastReportId === reportRef.id,
        insideMarikina: isInsideMarikina(input.latitude, input.longitude),
      },
      reportPayload: summarizePayload(reportPayload),
      guardPayload: summarizePayload(guardPayload),
    });

    batch.set(reportRef, reportPayload);
    batch.set(guardRef, guardPayload);

    await batch.commit();
    recentSubmitChecks.set(authoritativeUserId, Date.now());
    logReportTrace('report batch committed', {
      reportPath: `${REPORTS_COLLECTION}/${reportRef.id}`,
      guardPath: `${REPORT_SUBMISSION_GUARDS_COLLECTION}/${authoritativeUserId}`,
      authUid: auth.currentUser?.uid || null,
    });
    return reportRef;
  } catch (error) {
    logReportTrace('report batch failed', {
      authUid: auth.currentUser?.uid || null,
      callerUserId: input.userId || null,
      code: typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : null,
      message: error instanceof Error ? error.message : String(error),
    });
    if (cloudinaryMedia?.public_id && input.idToken) {
      deleteCloudinaryMedia(input.idToken, cloudinaryMedia.public_id, mediaResourceType, authoritativeUserId).catch(() => undefined);
    }
    throw error;
  }
}

export function subscribeToHazardReports(
  onReports: (reports: HazardReport[]) => void,
  onError: (error: FirestoreError) => void,
  maxReports = 300,
  filters?: ReportFilters
): Unsubscribe {
  const { db } = getFirebaseClients();
  const reportsQuery = query(
    collection(db, REPORTS_COLLECTION),
    ...buildTimeBoundQueryConstraints('timestamp', filters, maxReports)
  );

  let lastHash = '';

  return subscribeWithRetry(
    (handleError) => onSnapshot(
      reportsQuery,
      (snapshot) => {
        const reports = snapshot.docs
          .map(normalizeReport)
          .filter((report): report is HazardReport => Boolean(report))
          .filter((report) => matchesFilters(report, filters))
          .filter((report) => report.status !== 'resolved');
        const nextHash = reports.map((report) => `${report.id}:${report.timestamp?.getTime() || 0}:${report.likeCount}:${report.commentCount}:${report.viewCount}:${report.userReportCount}:${report.status}:${report.moderationStatus}`).join('|');

        if (nextHash === lastHash) return;
        lastHash = nextHash;
        onReports(reports);
      },
      handleError
    ),
    onError
  );
}

export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: ReportNotification[]) => void,
  onError: (error: FirestoreError) => void,
  maxNotifications = 100,
  filters?: ReportFilters
): Unsubscribe {
  const { db } = getFirebaseClients();
  let publicNotificationDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  let userNotificationDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  let readIds = new Set<string>();
  let reportsById = new Map<string, HazardReport>();

  let lastHash = '';

  const emit = () => {
    const docsById = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    publicNotificationDocs.forEach((snapshot) => docsById.set(snapshot.id, snapshot));
    userNotificationDocs.forEach((snapshot) => docsById.set(snapshot.id, snapshot));

    const notifications = [...docsById.values()]
      .map((snapshot) => {
        const reportId = snapshot.data().reportId;
        return normalizeNotification(snapshot, readIds, reportId ? reportsById.get(reportId) ?? null : null);
      })
      .filter((notification) => {
        if (notification.type === 'official_alert' && notification.shouldNotify === false) return false;
        if (notification.type === 'moderation_removed') return true;
        if (notification.report?.moderationStatus === 'removed' || notification.report?.status === 'rejected') return false;
        if (filters && notification.report) return matchesFilters(notification.report, filters);
        return matchesNotificationFilters(notification, filters);
      })
      .sort(sortNotifications);

    const nextHash = notifications.map((notification) => `${notification.id}:${notification.read}:${notification.source}:${notification.priority}:${notification.report?.id || ''}:${notification.report?.status || ''}:${notification.report?.moderationStatus || ''}`).join('|');
    if (nextHash === lastHash) return;
    lastHash = nextHash;
    onNotifications(notifications);
  };

  const publicNotificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('audience', '==', 'all'),
    ...buildTimeBoundQueryConstraints('createdAt', filters, maxNotifications)
  );
  const userNotificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('recipientId', '==', userId),
    ...buildTimeBoundQueryConstraints('createdAt', filters, maxNotifications)
  );
  const readsQuery = query(collection(db, NOTIFICATION_READS_COLLECTION), where('userId', '==', userId));
  const reportsQuery = query(
    collection(db, REPORTS_COLLECTION),
    ...buildTimeBoundQueryConstraints('timestamp', filters, maxNotifications)
  );

  const unsubscribePublicNotifications = subscribeWithRetry((handleError) => onSnapshot(publicNotificationsQuery, (snapshot) => {
    publicNotificationDocs = snapshot.docs;
    emit();
  }, handleError), onError);

  const unsubscribeUserNotifications = subscribeWithRetry((handleError) => onSnapshot(userNotificationsQuery, (snapshot) => {
    userNotificationDocs = snapshot.docs;
    emit();
  }, handleError), onError);

  const unsubscribeReads = subscribeWithRetry((handleError) => onSnapshot(readsQuery, (snapshot) => {
    readIds = new Set(snapshot.docs.map((readDoc) => readDoc.data().notificationId || readDoc.id.split('_').slice(1).join('_')));
    emit();
  }, handleError), onError);

  const unsubscribeReports = subscribeWithRetry((handleError) => onSnapshot(reportsQuery, (snapshot) => {
    reportsById = new Map(
      snapshot.docs
        .map(normalizeReport)
        .filter((report): report is HazardReport => Boolean(report))
        .map((report) => [report.id, report])
    );
    emit();
  }, handleError), onError);

  return () => {
    unsubscribePublicNotifications();
    unsubscribeUserNotifications();
    unsubscribeReads();
    unsubscribeReports();
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const { db } = getFirebaseClients();
  await setDoc(doc(db, NOTIFICATION_READS_COLLECTION, `${userId}_${notificationId}`), {
    userId,
    notificationId,
    readAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeToReportEngagement(
  reportId: string,
  userId: string | undefined,
  onEngagement: (engagement: ReportEngagement) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const { db } = getFirebaseClients();
  let reportData: DocumentData | undefined;
  let comments: ReportComment[] = [];
  let liveLikeCount: number | null = null;
  let liveViewCount: number | null = null;
  let likedByMe = false;
  let reportedByMe = false;

  const emit = () => {
    onEngagement({
      likeCount: liveLikeCount ?? reportData?.likeCount ?? 0,
      commentCount: reportData?.commentCount || comments.length,
      viewCount: liveViewCount ?? reportData?.viewCount ?? 0,
      userReportCount: reportData?.userReportCount || 0,
      likedByMe,
      reportedByMe,
      comments,
    });
  };

  let lastHash = '';
  const emitIfChanged = () => {
    const nextHash = JSON.stringify({
      commentIds: comments.map((comment) => `${comment.id}:${comment.createdAt?.getTime() || 0}`).join('|'),
      commentCount: reportData?.commentCount || comments.length,
      likeCount: liveLikeCount ?? reportData?.likeCount ?? 0,
      likedByMe,
      reportedByMe,
      userReportCount: reportData?.userReportCount || 0,
      viewCount: liveViewCount ?? reportData?.viewCount ?? 0,
    });
    if (nextHash === lastHash) return;
    lastHash = nextHash;
    emit();
  };

  const unsubscribeReport = subscribeWithRetry((handleError) => onSnapshot(doc(db, REPORTS_COLLECTION, reportId), (snapshot) => {
    reportData = snapshot.data();
    emitIfChanged();
  }, handleError), onError);

  const unsubscribeComments = subscribeWithRetry(
    (handleError) => onSnapshot(
      query(collection(db, REPORTS_COLLECTION, reportId, 'comments'), orderBy('createdAt', 'asc'), limit(40)),
      (snapshot) => {
        comments = snapshot.docs.map(normalizeComment);
        emitIfChanged();
      },
      handleError
    ),
    onError
  );

  const unsubscribers = [unsubscribeReport, unsubscribeComments];

  unsubscribers.push(subscribeWithRetry((handleError) => onSnapshot(collection(db, REPORTS_COLLECTION, reportId, 'likes'), (snapshot) => {
    liveLikeCount = snapshot.size;
    likedByMe = userId ? snapshot.docs.some((likeDoc) => likeDoc.id === userId) : false;
    emitIfChanged();
  }, handleError), onError));

  unsubscribers.push(subscribeWithRetry((handleError) => onSnapshot(collection(db, REPORTS_COLLECTION, reportId, 'userViews'), (snapshot) => {
    liveViewCount = snapshot.size;
    emitIfChanged();
  }, handleError), onError));

  if (userId) {
    unsubscribers.push(subscribeWithRetry((handleError) => onSnapshot(doc(db, REPORTS_COLLECTION, reportId, 'userReports', userId), (snapshot) => {
      reportedByMe = snapshot.exists();
      emitIfChanged();
    }, handleError), onError));
  }

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function recordReportView(reportId: string, userId?: string) {
  const engagementUserId = getCurrentFirebaseUid(userId);

  const { db } = getFirebaseClients();
  const viewRef = doc(db, REPORTS_COLLECTION, reportId, 'userViews', engagementUserId);

  await runLockedEngagementWrite(`view:${reportId}:${engagementUserId}`, async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const viewSnapshot = await transaction.get(viewRef);
        if (viewSnapshot.exists()) return;

        transaction.set(viewRef, {
          userId: engagementUserId,
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      ignoreAlreadyExists(error);
    }
  });
}

export async function toggleReportLike(reportId: string, userId: string) {
  const engagementUserId = getCurrentFirebaseUid(userId);
  const { db } = getFirebaseClients();
  const likeRef = doc(db, REPORTS_COLLECTION, reportId, 'likes', engagementUserId);

  await runLockedEngagementWrite(`like:${reportId}:${engagementUserId}`, async () => {
    const likeSnapshot = await getDocFromServer(likeRef).catch((error) => {
      if (isFirestoreErrorCode(error, 'unavailable')) return getDoc(likeRef);
      throw error;
    });

    if (likeSnapshot.exists()) {
      await deleteDoc(likeRef);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const transactionSnapshot = await transaction.get(likeRef);
        if (transactionSnapshot.exists()) {
          transaction.delete(likeRef);
          return;
        }

        transaction.set(likeRef, { userId: engagementUserId, createdAt: serverTimestamp() });
      });
    } catch (error) {
      ignoreAlreadyExists(error);
    }
  });
}

export async function addReportComment(reportId: string, userId: string, userName: string, body: string, userPhotoUrl = '') {
  const cleanBody = sanitizeText(body, 400);
  if (cleanBody.length < 2) throw new Error('Please add a longer comment.');
  if (cleanBody.length > 400) throw new Error('Comments are limited to 400 characters.');

  const engagementUserId = getCurrentFirebaseUid(userId);
  const { db } = getFirebaseClients();
  const commentRef = doc(collection(db, REPORTS_COLLECTION, reportId, 'comments'));
  const batch = writeBatch(db);

  batch.set(commentRef, {
    userId: engagementUserId,
    userName: sanitizeText(userName || 'Resident', 60) || 'Resident',
    userPhotoUrl,
    body: cleanBody,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, COMMENT_SUBMISSION_GUARDS_COLLECTION, engagementUserId), {
    lastCommentId: commentRef.id,
    lastSubmittedAt: serverTimestamp(),
    reportId,
    updatedAt: serverTimestamp(),
    userId: engagementUserId,
  });

  await batch.commit();
}

export async function reportCommunityPost(
  reportId: string,
  userId: string,
  category: ReportModerationCategory,
  note = ''
) {
  const engagementUserId = getCurrentFirebaseUid(userId);
  const { db } = getFirebaseClients();
  const userReportRef = doc(db, REPORTS_COLLECTION, reportId, 'userReports', engagementUserId);
  const cleanNote = sanitizeText(note, 240);

  await runLockedEngagementWrite(`report:${reportId}:${engagementUserId}`, async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const userReportSnapshot = await transaction.get(userReportRef);

        if (userReportSnapshot.exists()) return;

        transaction.set(userReportRef, {
          userId: engagementUserId,
          category,
          note: cleanNote,
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      ignoreAlreadyExists(error);
    }
  });
}

export async function deleteHazardReport(reportId: string, userId?: string) {
  const authoritativeUserId = getAuthoritativeFirebaseUid(userId);
  const { db } = getFirebaseClients();
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  const reportSnapshot = await getDocFromServer(reportRef).catch((error) => {
    if (isFirestoreErrorCode(error, 'unavailable')) return getDoc(reportRef);
    throw error;
  });

  if (!reportSnapshot.exists()) {
    throw new Error('This report has already been deleted.');
  }

  const ownerId = reportSnapshot.data().userId || reportSnapshot.data().sender_id;
  if (ownerId !== authoritativeUserId) {
    throw new Error('You can only delete your own hazard reports.');
  }

  await deleteDoc(reportRef);
}
