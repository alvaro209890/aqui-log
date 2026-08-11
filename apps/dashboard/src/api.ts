/**
 * URL da API.
 *
 * `VITE_API_URL` continua mandando quando existe (é assado no build). Sem ela,
 * o padrão depende de ONDE a página está servida: em `localhost` vale a API
 * local de desenvolvimento; servido pelo domínio público do runtime do acer
 * (`OPS-01A`/`DEC-26`), o padrão é a API pública do mesmo túnel. Sem essa
 * segunda regra, um `pnpm build` sem a variável (CI, outro agente) publicaria
 * um dashboard apontando para `localhost` — e a tela quebraria em silêncio no
 * navegador de quem abrisse pelo domínio.
 */
function resolveApiUrl(): string {
  const configurada = import.meta.env.VITE_API_URL;
  if (configurada) return configurada;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.protocol}//aquilog-api.cursar.space/api/v1`;
    }
  }
  return 'http://localhost:3001/api/v1';
}

const apiUrl = resolveApiUrl();

export interface Session {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface DashboardSummary {
  deliveriesToday: number;
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
  /** UUID do cliente; presente nos pedidos atuais. */
  customerId?: string | null;
  /** Categoria B2C; ausente/null em pedidos legados. */
  productType?: string | null;
  packageSize?: string | null;
  weightKg?: number | null;
  /** SCHED-01: modo e janela. Pedido legado vem como IMMEDIATE, sem janela. */
  fulfillmentMode?: string | null;
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  kmRateCents?: number | null;
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

export interface WeightBand {
  upToKg: number;
  surchargeCents: number;
}

export interface SizeSurcharges {
  SMALL: number;
  MEDIUM: number;
  LARGE: number;
}

export interface PlatformSettings {
  offerTtlSeconds: number;
  pricingBaseFeeCents: number;
  /** Legado v1; fallback quando não há tarifa por modo. */
  pricingPerKmCents: number;
  pricingPlatformFeePercent: number;
  pricingMinFeeCents: number;
  // B2C-02 / DEC-02
  pricingPerKmImmediateCents: number;
  pricingPerKmScheduledCents: number;
  pricingWeightBands: WeightBand[];
  pricingAboveTopBandCents: number;
  pricingSizeSurchargeCents: SizeSurcharges;
  // Multas e cutoffs (FLOW-DEC-01) — editáveis; cobrança ainda não implementada
  courierCancelFeeCents: number;
  courierCancelCutoffMinutesImmediate: number;
  courierCancelCutoffMinutesScheduled: number;
  customerCancelFeeCents: number;
  // SCHED-01 — modo agendado. `minScheduleLeadMinutes` vem do FLOW-DEC-02 (30);
  // os demais são provisórios e existem para calibrar a capacidade sem deploy.
  minScheduleLeadMinutes: number;
  scheduleMaxWindowMinutes: number;
  scheduleCapacitySlackMinutes: number;
  immediateExecutionEstimateMinutes: number;
  // DISP-01 / DEC-03 — reoferta por anéis. Valores provisórios e editáveis.
  dispatchInitialRadiusKm: number;
  dispatchRingIncrementKm: number;
  dispatchMaxRounds: number;
  dispatchTotalDurationMinutes: number;
  // DISP-02 — aviso de demora e proposta de aumento para o cliente.
  dispatchFirstWarningMinutes: number;
  dispatchPriceBoostPercent: number;
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
  courier?: string;
  date?: string;
  /** Filtro B2C-01B: categoria da encomenda. */
  productType?: string;
  /** Filtro B2C-01B: tamanho P/M/G. */
  packageSize?: string;
  /** Filtro SCHED-01: IMMEDIATE ou SCHEDULED. */
  fulfillmentMode?: string;
  /** Peso mínimo inclusivo (kg). */
  weightMin?: number | string;
  /** Peso máximo inclusivo (kg). */
  weightMax?: number | string;
  /** UUID do cliente. */
  customerId?: string;
  page?: number;
  limit?: number;
};

export const PRODUCT_TYPE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'FOOD', label: 'Alimento' },
  { value: 'ELECTRONICS', label: 'Eletronico' },
  { value: 'FRAGILE', label: 'Fragil' },
  { value: 'CLOTHING', label: 'Roupas' },
  { value: 'MEDICINE', label: 'Medicamento' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export const FULFILLMENT_MODE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'IMMEDIATE', label: 'Imediato' },
  { value: 'SCHEDULED', label: 'Agendado' },
] as const;

export const PACKAGE_SIZE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'SMALL', label: 'P' },
  { value: 'MEDIUM', label: 'M' },
  { value: 'LARGE', label: 'G' },
] as const;

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
