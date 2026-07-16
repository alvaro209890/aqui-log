const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export interface Session {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string; companyId: string | null };
}

export interface DashboardSummary {
  deliveriesToday: number;
  activeCompanies: number;
  availableCouriers: number;
  inProgress: number;
  revenueCents: number;
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
  createdAt: string;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(message ?? 'Nao foi possivel concluir a operacao');
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  summary: (token: string) => request<DashboardSummary>('/dashboard/summary', {}, token),
  deliveries: (token: string) => request<DeliveryRecord[]>('/deliveries', {}, token),
};
