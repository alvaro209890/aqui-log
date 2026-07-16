const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export interface Session {
  accessToken: string;
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

export type DeliveryFilters = {
  status?: string;
  company?: string;
  courier?: string;
  date?: string;
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
  return response.json() as Promise<T>;
}

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
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
  deliveries: (token: string, filters: DeliveryFilters = {}) =>
    request<DeliveryRecord[]>(
      `/deliveries${qs(filters)}`,
      {},
      token,
    ),
  companies: (token: string) =>
    request<CompanyRecord[]>('/companies', {}, token),
  couriers: (token: string) => request<CourierRecord[]>('/couriers', {}, token),
  financeSummary: (token: string) =>
    request<FinanceSummary>('/finance/summary', {}, token),
  ratings: (token: string) =>
    request<RatingRecord[]>('/deliveries/ratings', {}, token),
  notifications: (token: string) =>
    request<NotificationRecord[]>('/notifications', {}, token),
  approveCompany: (token: string, id: string) =>
    request<CompanyRecord>(
      `/companies/${id}/approve`,
      { method: 'PATCH' },
      token,
    ),
  approveCourier: (token: string, id: string) =>
    request<CourierRecord>(
      `/couriers/${id}/approve`,
      { method: 'PATCH' },
      token,
    ),
};
