export type EvacuationSite = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  active?: boolean;
  sortOrder?: number;
};
