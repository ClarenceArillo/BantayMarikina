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
