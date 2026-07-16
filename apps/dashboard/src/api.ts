const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export interface Session {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string | null;
  };
}

export interface DashboardSummary {
  deliveriesToday: number;
  activeCompanies: number;
  availableCouriers: number;
  inProgress: number;
  revenueCents: number;
}

export interface TrendMetric {
  value: number;
  previous: number;
  changePercent: number | null;
}

export interface DashboardTrends {
  deliveriesToday: TrendMetric;
  inProgress: TrendMetric;
  delivered: TrendMetric;
  canceled: TrendMetric;
  avgMinutes: TrendMetric;
  spendCents: TrendMetric;
  savingsCents: TrendMetric;
}

export interface HourSeriesResponse {
  date: string;
  series: Array<{ hour: number; count: number }>;
}

export interface StatusSeriesResponse {
  items: Array<{ status: string; count: number }>;
}

export interface PerformanceResponse {
  score: number;
  onTimePercent: number;
  acceptRatePercent: number;
  satisfaction: number;
  label: string;
}

export interface DeliveryRecord {
  id: string;
  code: string;
  companyId: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  courierId: string | null;
  status: string;
  priceCents?: number;
  createdAt: string;
}

export interface CompanyRecord {
  id: string;
  legalName?: string;
  tradeName?: string;
  document?: string;
  status: string;
  createdAt?: string;
}

export interface CourierRecord {
  id: string;
  userId?: string;
  document?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  status: string;
  available?: boolean;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
}

export interface RatingRecord {
  id: string;
  deliveryId: string;
  companyId: string;
  courierId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface FinanceSummary {
  grossCents: number;
  courierCostCents: number;
  deliveredCount: number;
  netCents?: number;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  companyId: string | null;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformSettings {
  offerTtlSeconds: number;
  pricingBaseFeeCents: number;
  pricingPerKmCents: number;
  pricingPlatformFeePercent: number;
  pricingMinFeeCents: number;
}

export interface ReportRange {
  from: string;
  to: string;
  timezone: string;
  created: number;
  delivered: number;
  canceled: number;
  revenueCents: number;
  byStatus: Array<{ status: string; count: number }>;
}

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type DeliveryFilters = {
  status?: string;
  company?: string;
  courier?: string;
  date?: string;
  page?: number;
  limit?: number;
};

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    throw new Error(message ?? 'Nao foi possivel concluir a operacao');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

function asPage<T>(data: T[] | PageResult<T>): PageResult<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      limit: data.length || 20,
      totalPages: 1,
    };
  }
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request<Session>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  summary: (token: string) =>
    request<DashboardSummary>('/dashboard/summary', {}, token),
  trends: (token: string) =>
    request<DashboardTrends>('/dashboard/trends', {}, token),
  deliveriesByHour: (token: string, date?: string) =>
    request<HourSeriesResponse>(
      `/dashboard/charts/deliveries-by-hour${qs({ date })}`,
      {},
      token,
    ),
  deliveriesByStatus: (token: string) =>
    request<StatusSeriesResponse>(
      '/dashboard/charts/deliveries-by-status',
      {},
      token,
    ),
  performance: (token: string) =>
    request<PerformanceResponse>('/dashboard/performance', {}, token),
  reportRange: (token: string, from: string, to: string) =>
    request<ReportRange>(
      `/dashboard/reports${qs({ from, to })}`,
      {},
      token,
    ),
  deliveries: async (token: string, filters: DeliveryFilters = {}) => {
    const data = await request<DeliveryRecord[] | PageResult<DeliveryRecord>>(
      `/deliveries${qs(filters)}`,
      {},
      token,
    );
    return asPage(data);
  },
  companies: async (token: string, page = 1, limit = 20) =>
    asPage(
      await request<CompanyRecord[] | PageResult<CompanyRecord>>(
        `/companies${qs({ page, limit })}`,
        {},
        token,
      ),
    ),
  couriers: async (token: string, page = 1, limit = 20) =>
    asPage(
      await request<CourierRecord[] | PageResult<CourierRecord>>(
        `/couriers${qs({ page, limit })}`,
        {},
        token,
      ),
    ),
  users: async (token: string, page = 1, limit = 20) =>
    asPage(
      await request<UserRecord[] | PageResult<UserRecord>>(
        `/users${qs({ page, limit })}`,
        {},
        token,
      ),
    ),
  audit: async (token: string, page = 1, limit = 50) =>
    asPage(
      await request<AuditRecord[] | PageResult<AuditRecord>>(
        `/audit${qs({ page, limit })}`,
        {},
        token,
      ),
    ),
  settings: (token: string) =>
    request<PlatformSettings>('/settings', {}, token),
  updateSettings: (token: string, body: Partial<PlatformSettings>) =>
    request<PlatformSettings>(
      '/settings',
      { method: 'PATCH', body: JSON.stringify(body) },
      token,
    ),
  financeSummary: (token: string) =>
    request<FinanceSummary>('/finance/summary', {}, token),
  ratings: (token: string) =>
    request<RatingRecord[]>('/deliveries/ratings', {}, token),
  notifications: (token: string) =>
    request<NotificationRecord[]>('/notifications', {}, token),
  markNotificationRead: (token: string, id: string) =>
    request<NotificationRecord>(
      `/notifications/${id}/read`,
      { method: 'PATCH' },
      token,
    ),
  approveCompany: (token: string, id: string) =>
    request<CompanyRecord>(
      `/companies/${id}/approve`,
      { method: 'PATCH' },
      token,
    ),
  rejectCompany: (token: string, id: string) =>
    request<CompanyRecord>(
      `/companies/${id}/reject`,
      { method: 'PATCH' },
      token,
    ),
  suspendCompany: (token: string, id: string) =>
    request<CompanyRecord>(
      `/companies/${id}/suspend`,
      { method: 'PATCH' },
      token,
    ),
  approveCourier: (token: string, id: string) =>
    request<CourierRecord>(
      `/couriers/${id}/approve`,
      { method: 'PATCH' },
      token,
    ),
  rejectCourier: (token: string, id: string) =>
    request<CourierRecord>(
      `/couriers/${id}/reject`,
      { method: 'PATCH' },
      token,
    ),
  suspendCourier: (token: string, id: string) =>
    request<CourierRecord>(
      `/couriers/${id}/suspend`,
      { method: 'PATCH' },
      token,
    ),
  dispatchDelivery: (token: string, id: string) =>
    request<{ delivery: DeliveryRecord }>(
      `/deliveries/${id}/dispatch`,
      { method: 'POST' },
      token,
    ),
  assignDelivery: (token: string, id: string, courierId: string) =>
    request<unknown>(
      `/deliveries/${id}/assign`,
      { method: 'PATCH', body: JSON.stringify({ courierId }) },
      token,
    ),
  cancelDelivery: (token: string, id: string) =>
    request<DeliveryRecord>(
      `/deliveries/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELED', note: 'Cancelado no painel' }),
      },
      token,
    ),
};
