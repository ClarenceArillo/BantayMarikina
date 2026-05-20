export const HAZARD_TYPES = [
  'Flood',
  'Fire',
  'Landslide',
  'Earthquake Damage',
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
  status: 'active' | 'pending' | 'resolved' | 'rejected';
  source?: 'official' | 'community';
  moderationStatus?: 'visible' | 'removed';
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  userReportCount?: number;
  accuracyMeters?: number | null;
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
  reporterName?: string;
  imageUri?: string;
};

export const DATE_FILTERS = ['today', 'yesterday', 'week', 'month', 'custom'] as const;
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
  type: 'new_report' | 'moderation_removed';
  title: string;
  body: string;
  hazardType?: string;
  severity?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  barangay?: string;
  reporterName?: string;
  createdAt: Date | null;
  read: boolean;
  report?: HazardReport | null;
};

export type ReportComment = {
  id: string;
  userId: string;
  userName: string;
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
