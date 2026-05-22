import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { getFirebaseClients } from '@/config/firebase';
import { deleteCloudinaryMedia, uploadToCloudinary, cloudinaryOptimizedUrl, cloudinaryVideoPosterUrl } from '@/services/cloudinaryService';
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
const MODERATION_LOGS_COLLECTION = 'ModerationLogs';
const USER_REPORT_CATEGORIES: ReportModerationCategory[] = [
  'false_report',
  'inaccurate_image',
  'misleading_information',
  'spam',
  'other',
];
const MARIKINA_BOUNDS = {
  minLat: 14.57,
  maxLat: 14.72,
  minLng: 121.03,
  maxLng: 121.18,
};

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
      ? cloudinaryVideoPosterUrl(firstMedia.secure_url)
      : cloudinaryOptimizedUrl(data.imageUrl || data.image_url || firstMedia?.secure_url),
    media,
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
    imageUrl: data.imageUrl,
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

export function isInsideMarikina(latitude: number, longitude: number) {
  return (
    latitude >= MARIKINA_BOUNDS.minLat &&
    latitude <= MARIKINA_BOUNDS.maxLat &&
    longitude >= MARIKINA_BOUNDS.minLng &&
    longitude <= MARIKINA_BOUNDS.maxLng
  );
}

export function validateHazardReport(input: HazardReportInput) {
  const description = input.description.trim();

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

  const { db } = getFirebaseClients();
  if (input.userId) {
    const recentSnapshot = await getDocs(query(
      collection(db, REPORTS_COLLECTION),
      where('userId', '==', input.userId),
      orderBy('timestamp', 'desc'),
      limit(1)
    ));
    const lastReportAt = recentSnapshot.docs[0] ? toDate(recentSnapshot.docs[0].data().timestamp || recentSnapshot.docs[0].data().createdAt) : null;
    if (lastReportAt && Date.now() - lastReportAt.getTime() < 60_000) {
      throw new Error('Please wait a minute before submitting another report.');
    }
  }
  const mediaResourceType = input.mediaType === 'video' ? 'video' : 'image';
  const cloudinaryMedia = input.imageUri && input.idToken
    ? await uploadToCloudinary({
        folder: mediaResourceType === 'video' ? 'reports/videos' : 'reports/images',
        idToken: input.idToken,
        mediaUri: input.imageUri,
        onProgress: input.onUploadProgress,
        resourceType: mediaResourceType,
      })
    : null;
  const imageUrl = cloudinaryMedia?.secure_url || null;
  const title = `${input.severity} ${input.hazardType}`;

  try {
    const reportRef = await addDoc(collection(db, REPORTS_COLLECTION), {
    title,
    hazardType: input.hazardType,
    hazard_type: input.hazardType,
    description: input.description.trim(),
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
    cloudinaryMedia,
    media: cloudinaryMedia ? [cloudinaryMedia] : [],
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

    await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    audience: 'all',
    type: 'new_report',
    reportId: reportRef.id,
    title,
    body: input.description.trim(),
    hazardType: input.hazardType,
    severity: input.severity,
    imageUrl,
    latitude: input.latitude,
    longitude: input.longitude,
    barangay: input.barangay || '',
    reporterName: input.reporterName || 'Resident',
    reporterPhotoUrl: input.reporterPhotoUrl || '',
    createdAt: serverTimestamp(),
    });

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

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      const reports = snapshot.docs
        .map(normalizeReport)
        .filter((report): report is HazardReport => Boolean(report))
        .filter((report) => matchesFilters(report, filters))
        .filter((report) => report.status !== 'resolved');

      onReports(reports);
    },
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
  let notificationDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  let readIds = new Set<string>();
  let reportsById = new Map<string, HazardReport>();

  const emit = () => {
    const notifications = notificationDocs
      .filter((snapshot) => {
        const data = snapshot.data();
        return data.audience === 'all' || data.recipientId === userId;
      })
      .map((snapshot) => {
        const reportId = snapshot.data().reportId;
        return normalizeNotification(snapshot, readIds, reportId ? reportsById.get(reportId) ?? null : null);
      })
      .filter((notification) => {
        if (notification.type === 'moderation_removed') return true;
        if (notification.report?.moderationStatus === 'removed' || notification.report?.status === 'rejected') return false;
        if (filters && notification.report) return matchesFilters(notification.report, filters);
        return true;
      })
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    onNotifications(notifications);
  };

  const notificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxNotifications)
  );
  const readsQuery = query(collection(db, NOTIFICATION_READS_COLLECTION), where('userId', '==', userId));
  const reportsQuery = query(collection(db, REPORTS_COLLECTION), orderBy('timestamp', 'desc'), limit(maxNotifications));

  const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
    notificationDocs = snapshot.docs;
    emit();
  }, onError);

  const unsubscribeReads = onSnapshot(readsQuery, (snapshot) => {
    readIds = new Set(snapshot.docs.map((readDoc) => readDoc.data().notificationId || readDoc.id.split('_').slice(1).join('_')));
    emit();
  }, onError);

  const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
    reportsById = new Map(
      snapshot.docs
        .map(normalizeReport)
        .filter((report): report is HazardReport => Boolean(report))
        .map((report) => [report.id, report])
    );
    emit();
  }, onError);

  return () => {
    unsubscribeNotifications();
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

  const unsubscribeReport = onSnapshot(doc(db, REPORTS_COLLECTION, reportId), (snapshot) => {
    reportData = snapshot.data();
    emit();
  }, onError);

  const unsubscribeComments = onSnapshot(
    query(collection(db, REPORTS_COLLECTION, reportId, 'comments'), orderBy('createdAt', 'asc'), limit(40)),
    (snapshot) => {
      comments = snapshot.docs.map(normalizeComment);
      emit();
    },
    onError
  );

  const unsubscribers = [unsubscribeReport, unsubscribeComments];

  if (userId) {
    unsubscribers.push(onSnapshot(doc(db, REPORTS_COLLECTION, reportId, 'likes', userId), (snapshot) => {
      likedByMe = snapshot.exists();
      emit();
    }, onError));
    unsubscribers.push(onSnapshot(doc(db, REPORTS_COLLECTION, reportId, 'userReports', userId), (snapshot) => {
      reportedByMe = snapshot.exists();
      emit();
    }, onError));
  }

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function recordReportView(reportId: string, userId?: string) {
  if (!userId) return;

  const { db } = getFirebaseClients();
  const viewRef = doc(db, REPORTS_COLLECTION, reportId, 'userViews', userId);
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);

  await runTransaction(db, async (transaction) => {
    const viewSnapshot = await transaction.get(viewRef);
    if (viewSnapshot.exists()) return;

    transaction.set(viewRef, {
      userId,
      createdAt: serverTimestamp(),
    });
    transaction.update(reportRef, {
      viewCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function toggleReportLike(reportId: string, userId: string) {
  const { db } = getFirebaseClients();
  const likeRef = doc(db, REPORTS_COLLECTION, reportId, 'likes', userId);
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);

  await runTransaction(db, async (transaction) => {
    const likeSnapshot = await transaction.get(likeRef);

    if (likeSnapshot.exists()) {
      transaction.delete(likeRef);
      transaction.update(reportRef, { likeCount: increment(-1), updatedAt: serverTimestamp() });
      return;
    }

    transaction.set(likeRef, { userId, createdAt: serverTimestamp() });
    transaction.update(reportRef, { likeCount: increment(1), updatedAt: serverTimestamp() });
  });
}

export async function addReportComment(reportId: string, userId: string, userName: string, body: string, userPhotoUrl = '') {
  const cleanBody = body.trim();
  if (cleanBody.length < 2) throw new Error('Please add a longer comment.');
  if (cleanBody.length > 400) throw new Error('Comments are limited to 400 characters.');

  const { db } = getFirebaseClients();
  await addDoc(collection(db, REPORTS_COLLECTION, reportId, 'comments'), {
    userId,
    userName: userName || 'Resident',
    userPhotoUrl,
    body: cleanBody,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, REPORTS_COLLECTION, reportId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

function getDominantCategory(categories: Record<string, number>) {
  return USER_REPORT_CATEGORIES.reduce<ReportModerationCategory>((dominant, category) => {
    return (categories[category] || 0) > (categories[dominant] || 0) ? category : dominant;
  }, 'other');
}

function formatModerationCategory(category: ReportModerationCategory) {
  return category.replace(/_/g, ' ');
}

export async function reportCommunityPost(
  reportId: string,
  userId: string,
  category: ReportModerationCategory,
  note = ''
) {
  const { db } = getFirebaseClients();
  const reportRef = doc(db, REPORTS_COLLECTION, reportId);
  const userReportRef = doc(db, REPORTS_COLLECTION, reportId, 'userReports', userId);
  const moderationLogRef = doc(collection(db, MODERATION_LOGS_COLLECTION));
  const notificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    const userReportSnapshot = await transaction.get(userReportRef);

    if (!reportSnapshot.exists()) throw new Error('Report no longer exists.');
    if (userReportSnapshot.exists()) return;

    const reportData = reportSnapshot.data();
    const nextReportCount = (reportData.userReportCount || 0) + 1;
    const viewCount = Math.max(reportData.viewCount || 0, 1);
    const categoryCounts = {
      ...(reportData.reportCategoryCounts || {}),
      [category]: (reportData.reportCategoryCounts?.[category] || 0) + 1,
    };
    const dominantCategory = getDominantCategory(categoryCounts);
    const shouldRemove = nextReportCount / viewCount > 0.5;

    transaction.set(userReportRef, {
      userId,
      category,
      note: note.trim(),
      createdAt: serverTimestamp(),
    });

    transaction.update(reportRef, {
      userReportCount: nextReportCount,
      reportCategoryCounts: categoryCounts,
      moderationStatus: shouldRemove ? 'removed' : reportData.moderationStatus || 'visible',
      status: shouldRemove ? 'rejected' : reportData.status || 'active',
      removedReason: shouldRemove ? dominantCategory : reportData.removedReason || null,
      updatedAt: serverTimestamp(),
    });

    if (shouldRemove) {
      transaction.set(moderationLogRef, {
        reportId,
        reporterId: reportData.userId || null,
        reportCount: nextReportCount,
        uniqueViews: viewCount,
        dominantCategory,
        categoryCounts,
        action: 'auto_removed',
        createdAt: serverTimestamp(),
      });

      if (reportData.userId) {
        transaction.set(notificationRef, {
          audience: 'user',
          recipientId: reportData.userId,
          type: 'moderation_removed',
          reportId,
          title: 'Report removed',
          body: `Your report has been removed due to multiple community reports for ${formatModerationCategory(dominantCategory)}.`,
          hazardType: reportData.hazardType || reportData.hazard_type || 'Hazard',
          severity: reportData.severity || 'Moderate',
          createdAt: serverTimestamp(),
        });
      }
    }
  });
}
