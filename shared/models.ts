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
  writable?: boolean;
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
  visitors?: number;
  requests?: number | null;
  bandwidth?: number;
  analyticsError?: string;
  change: number | null;
  series: number[];
}
export interface CalendarEvent {
  allDay?: boolean;
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  location: string;
}
export interface Integration {
  configured?: boolean;
  id: string;
  name: string;
  category: string;
  description: string;
  status: "demo" | "connected" | "not_configured" | "needs_reauth" | "error";
}
export interface DashboardData {
  integrationErrors?: { calendar?: string; cloudflare?: string };
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
  nextCursor?: string;
}

export const siteCount = (site: Site) => site.requests ?? site.visitors ?? 0;
export const siteValue = (site: Site) =>
  site.requests === null ? "—" : siteCount(site).toLocaleString();
