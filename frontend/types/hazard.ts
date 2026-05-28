export const HAZARD_TYPES = [
  'Flood',
  'Fire',
  'Landslide',
  'Earthquake Damage',
  'Earthquake',
  'Typhoon',
  'Extreme Heat',
  'High Water Level',
  'Road Blockage',
  'Power Outage',
  'Others',
] as const;

export const SEVERITY_LEVELS = ['Low', 'Moderate', 'High', 'Critical'] as const;

export type HazardType = (typeof HAZARD_TYPES)[number];
export type HazardSeverity = (typeof SEVERITY_LEVELS)[number];

export type HazardReport = {
  id: string;
  hazardType: HazardType | string;
  title?: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp: Date | null;
  userId?: string;
  reporterName?: string;
  severity?: HazardSeverity | string;
  barangay?: string;
  imageUrl?: string;
  media?: CloudinaryMedia[];
  capturedAtLabel?: string;
  reporterPhotoUrl?: string;
  status: 'active' | 'pending' | 'resolved' | 'rejected';
  source?: 'official' | 'community';
  moderationStatus?: 'visible' | 'removed';
  magnitude?: number;
  intensity?: number;
  signalLevel?: number;
  shouldNotify?: boolean;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  userReportCount?: number;
  accuracyMeters?: number | null;
};

export type CloudinaryMedia = {
  secure_url: string;
  public_id: string;
  resource_type: 'image' | 'video';
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  bytes?: number;
  createdAt?: string;
};

export type HazardReportInput = {
  hazardType: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  severity: HazardSeverity;
  barangay?: string;
  userId?: string;
  idToken?: string;
  reporterName?: string;
  reporterPhotoUrl?: string;
  imageUri?: string;
  mediaSizeBytes?: number;
  mediaType?: 'image' | 'video';
  capturedAtLabel?: string;
  onUploadProgress?: (progress: number) => void;
};

export const DATE_FILTERS = ['today', 'yesterday', 'week', 'month', 'year', 'custom'] as const;
export type ReportDateFilter = (typeof DATE_FILTERS)[number];

export type ReportFilters = {
  dateRange: ReportDateFilter;
  hazardType?: HazardType | 'All';
  severity?: HazardSeverity | 'All';
  status?: 'active' | 'pending' | 'resolved' | 'rejected' | 'All';
  source?: 'official' | 'community' | 'All';
  customStart?: Date | null;
  customEnd?: Date | null;
};

export type ReportNotification = {
  id: string;
  reportId?: string;
  recipientId?: string | null;
  audience?: 'all' | 'user';
  type: 'new_report' | 'moderation_removed' | 'official_alert';
  title: string;
  body: string;
  hazardType?: string;
  severity?: string;
  source?: 'official' | 'community' | 'admin';
  sourceLabel?: string;
  safetyTip?: string;
  affectedArea?: string;
  priority?: 'normal' | 'high' | 'critical';
  magnitude?: number;
  intensity?: number;
  signalLevel?: number;
  shouldNotify?: boolean;
  imageUrl?: string;
  capturedAtLabel?: string;
  latitude?: number;
  longitude?: number;
  barangay?: string;
  reporterName?: string;
  moderationReason?: ReportModerationCategory | string;
  moderationReasonLabel?: string;
  createdAt: Date | null;
  read: boolean;
  report?: HazardReport | null;
};

export type ReportComment = {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  body: string;
  createdAt: Date | null;
};

export type ReportModerationCategory =
  | 'false_report'
  | 'inaccurate_image'
  | 'misleading_information'
  | 'spam'
  | 'other';

export type ReportEngagement = {
  likeCount: number;
  commentCount: number;
  viewCount: number;
  userReportCount: number;
  likedByMe: boolean;
  reportedByMe: boolean;
  comments: ReportComment[];
};
