export type ProviderId = "r2" | "drive";
export interface StorageFile {
  id: string;
  provider: ProviderId;
  providerId: string;
  name: string;
  virtualPath: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
}
export interface StorageUsage {
  provider: ProviderId;
  label: string;
  used: number;
  capacity: number | null;
}
export interface Note {
  id: string;
  title: string;
  body: string;
  color: "sage" | "lavender" | "sand";
  pinned: boolean;
  updatedAt: string;
}
export interface Site {
  id: string;
  name: string;
  url: string;
  status: "healthy" | "warning";
  visitors: number;
  change: number;
  series: number[];
}
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  location: string;
}
export interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  status: "demo" | "connected" | "not_configured";
}
export interface DashboardData {
  sites: Site[];
  events: CalendarEvent[];
  activity: {
    id: string;
    title: string;
    detail: string;
    time: string;
    type: "deploy" | "file" | "commit";
  }[];
}
export interface ApiResult<T> {
  data: T;
  mode: "demo" | "live";
}
