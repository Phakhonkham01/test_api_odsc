/** One service centre, exactly as the Smart ODSC Partner API returns it. */
export interface ServiceCenter {
  id: string;
  name: string;
  type: "CENTER" | "TASAENG";
  province: Area | null;
  district: Area | null;
  village: string | null;
  location: { latitude: number; longitude: number } | null;
  openingHours: {
    openDay: string | null;
    closeDay: string | null;
    morning: string | null;
    afternoon: string | null;
  };
  imageUrl: string | null;
  updatedAt: string;
}

export interface Area {
  id: string;
  nameLo: string;
  nameEn: string;
}

export interface ListResponse {
  data: ServiceCenter[];
  page: { page: number; limit: number; total: number; totalPages: number };
}

/** What the ministry's backend reports about its last exchange with Smart ODSC. */
export interface Connection {
  baseUrl: string;
  clientId: string;
  token: {
    requestedAt: string;
    expiresAt: string | null;
    scope: string | null;
    status: number;
    error: string | null;
  } | null;
  lastCall: {
    at: string;
    method: string;
    path: string;
    status: number;
    requestId: string | null;
    ms: number;
    rows: number | null;
  } | null;
  listServedFrom: "smart-odsc" | "ministry-cache" | null;
}

/** One service, as GET /partner/v1/services returns it. */
export interface Service {
  id: string;
  name: string;
  shortDescription: string | null;
  iconUrl: string | null;
  organization: { id: string; name: string } | null;
  serviceTypeIds: string[];
  fee: {
    type: "FIXED" | "NONE";
    total: number;
    currency: string;
    items: { label: string; amount: number; currency: string; note: string | null }[];
  };
  channels: { online: boolean; serviceCenter: boolean };
  updatedAt: string;
}

/** GET /partner/v1/services/{id} adds the full description, as plain text. */
export interface ServiceDetail extends Service {
  description: string | null;
}

export interface ServiceType {
  id: string;
  name: string;
  iconUrl: string | null;
  serviceCount: number;
}

export interface Page<T> {
  data: T[];
  page: { page: number; limit: number; total: number; totalPages: number };
}

/** One request and its response, as the playground backend reports them. */
export interface Exchange {
  request: { method: string; url: string; headers: Record<string, string>; body: string | null };
  response: { status: number; headers: Record<string, string>; body: unknown; bytes: number };
  ms: number;
}

export interface PlaygroundSetup {
  baseUrl: string;
  clientId: string;
  secretPreview: string;
  secretLength: number;
  basicPreview: string;
}
