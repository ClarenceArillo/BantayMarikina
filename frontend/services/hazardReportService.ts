import {
  Timestamp,
  collection,
  doc,
  getDoc,
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
    timestamp: toDate(data.timestamp || data.createdAt),
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
    createdAt: toDate(data.createdAt),
  };
}

function normalizeNotification(
  doc: QueryDocumentSnapshot<DocumentData>,
  readIds: Set<string>,
  report?: HazardReport | null
): ReportNotification {
  const data = doc.data();

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
    imageUrl: data.imageUrl,
    capturedAtLabel: data.capturedAtLabel || data.captured_at_label || report?.capturedAtLabel,
    latitude: data.latitude,
    longitude: data.longitude,
    barangay: data.barangay,
    reporterName: data.reporterName,
    createdAt: toDate(data.createdAt),
    read: readIds.has(doc.id),
    report,
  };
}

function getDateWindow(filters?: ReportFilters) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (!filters || filters.dateRange === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (filters.dateRange === 'today') {
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (filters.dateRange === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate());
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (filters.dateRange === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  return {
    start: filters.customStart || null,
    end: filters.customEnd || null,
  };
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
  if (!input.userId) {
    throw new Error('Please sign in before submitting a report.');
  }

  const { db } = getFirebaseClients();
  const lastLocalSubmitAt = recentSubmitChecks.get(input.userId) || 0;
  if (Date.now() - lastLocalSubmitAt < RECENT_REPORT_COOLDOWN_MS) {
    throw new Error('Please wait a minute before submitting another report.');
  }

  let lastReportAt: Date | null = null;
  try {
    const guardSnapshot = await getDoc(doc(db, REPORT_SUBMISSION_GUARDS_COLLECTION, input.userId));
    lastReportAt = guardSnapshot.exists()
      ? toDate(guardSnapshot.data().lastSubmittedAt || guardSnapshot.data().updatedAt)
      : null;
  } catch {
    // Guard reads are a throttle optimization. Server rules still enforce the cooldown.
  }

  if (lastReportAt && Date.now() - lastReportAt.getTime() < RECENT_REPORT_COOLDOWN_MS) {
    recentSubmitChecks.set(input.userId, lastReportAt.getTime());
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
    userId: input.userId || null,
    sender_id: input.userId || null,
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
    const batch = writeBatch(db);

    batch.set(reportRef, reportPayload);
    batch.set(doc(db, REPORT_SUBMISSION_GUARDS_COLLECTION, input.userId), {
      lastReportId: reportRef.id,
      lastSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userId: input.userId,
    }, { merge: true });

    await batch.commit();
    recentSubmitChecks.set(input.userId, Date.now());
    return reportRef;
  } catch (error) {
    if (cloudinaryMedia?.public_id && input.idToken) {
      deleteCloudinaryMedia(input.idToken, cloudinaryMedia.public_id, mediaResourceType, input.userId).catch(() => undefined);
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
    orderBy('timestamp', 'desc'),
    limit(maxReports)
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
        if (notification.type === 'moderation_removed') return true;
        if (notification.report?.moderationStatus === 'removed' || notification.report?.status === 'rejected') return false;
        if (filters && notification.report) return matchesFilters(notification.report, filters);
        return matchesNotificationFilters(notification, filters);
      })
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    const nextHash = notifications.map((notification) => `${notification.id}:${notification.read}:${notification.source}:${notification.priority}:${notification.report?.id || ''}:${notification.report?.status || ''}:${notification.report?.moderationStatus || ''}`).join('|');
    if (nextHash === lastHash) return;
    lastHash = nextHash;
    onNotifications(notifications);
  };

  const publicNotificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('audience', '==', 'all'),
    orderBy('createdAt', 'desc'),
    limit(maxNotifications)
  );
  const userNotificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxNotifications)
  );
  const readsQuery = query(collection(db, NOTIFICATION_READS_COLLECTION), where('userId', '==', userId));
  const reportsQuery = query(collection(db, REPORTS_COLLECTION), orderBy('timestamp', 'desc'), limit(maxNotifications));

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
  let likedByMe = false;
  let reportedByMe = false;

  const emit = () => {
    onEngagement({
      likeCount: reportData?.likeCount || 0,
      commentCount: reportData?.commentCount || comments.length,
      viewCount: reportData?.viewCount || 0,
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
      likeCount: reportData?.likeCount || 0,
      likedByMe,
      reportedByMe,
      userReportCount: reportData?.userReportCount || 0,
      viewCount: reportData?.viewCount || 0,
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

  if (userId) {
    unsubscribers.push(subscribeWithRetry((handleError) => onSnapshot(doc(db, REPORTS_COLLECTION, reportId, 'likes', userId), (snapshot) => {
      likedByMe = snapshot.exists();
      emitIfChanged();
    }, handleError), onError));
    unsubscribers.push(subscribeWithRetry((handleError) => onSnapshot(doc(db, REPORTS_COLLECTION, reportId, 'userReports', userId), (snapshot) => {
      reportedByMe = snapshot.exists();
      emitIfChanged();
    }, handleError), onError));
  }

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function recordReportView(reportId: string, userId?: string) {
  if (!userId) return;

  const { db } = getFirebaseClients();
  const viewRef = doc(db, REPORTS_COLLECTION, reportId, 'userViews', userId);

  await runTransaction(db, async (transaction) => {
    const viewSnapshot = await transaction.get(viewRef);
    if (viewSnapshot.exists()) return;

    transaction.set(viewRef, {
      userId,
      createdAt: serverTimestamp(),
    });
  });
}

export async function toggleReportLike(reportId: string, userId: string) {
  const { db } = getFirebaseClients();
  const likeRef = doc(db, REPORTS_COLLECTION, reportId, 'likes', userId);

  await runTransaction(db, async (transaction) => {
    const likeSnapshot = await transaction.get(likeRef);

    if (likeSnapshot.exists()) {
      transaction.delete(likeRef);
      return;
    }

    transaction.set(likeRef, { userId, createdAt: serverTimestamp() });
  });
}

export async function addReportComment(reportId: string, userId: string, userName: string, body: string, userPhotoUrl = '') {
  const cleanBody = sanitizeText(body, 400);
  if (cleanBody.length < 2) throw new Error('Please add a longer comment.');
  if (cleanBody.length > 400) throw new Error('Comments are limited to 400 characters.');

  const { db } = getFirebaseClients();
  const commentRef = doc(collection(db, REPORTS_COLLECTION, reportId, 'comments'));
  const batch = writeBatch(db);

  batch.set(commentRef, {
    userId,
    userName: sanitizeText(userName || 'Resident', 60) || 'Resident',
    userPhotoUrl,
    body: cleanBody,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, COMMENT_SUBMISSION_GUARDS_COLLECTION, userId), {
    lastCommentId: commentRef.id,
    lastSubmittedAt: serverTimestamp(),
    reportId,
    updatedAt: serverTimestamp(),
    userId,
  }, { merge: true });

  await batch.commit();
}

export async function reportCommunityPost(
  reportId: string,
  userId: string,
  category: ReportModerationCategory,
  note = ''
) {
  const { db } = getFirebaseClients();
  const userReportRef = doc(db, REPORTS_COLLECTION, reportId, 'userReports', userId);
  const cleanNote = sanitizeText(note, 240);

  await runTransaction(db, async (transaction) => {
    const userReportSnapshot = await transaction.get(userReportRef);

    if (userReportSnapshot.exists()) return;

    transaction.set(userReportRef, {
      userId,
      category,
      note: cleanNote,
      createdAt: serverTimestamp(),
    });
  });
}
