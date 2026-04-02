import { getAuthHeaders, getStoredAuth } from '../../utils/authStorage';
import { getMerchantOrderFinancials } from '../../utils/merchantFinance';

interface ErrorPayload {
  error?: string;
  message?: string;
}

interface LegacyOrder {
  id: string;
  status?: string;
  total?: number;
  deliveryFee?: number;
  tax?: number;
  platformFee?: number;
  discountAmount?: number;
  merchantNetIncome?: number;
  customerTotal?: number;
  createdAt?: string;
  items?: Array<{ product?: { name?: string }; productId?: string; quantity?: number; price?: number }>;
  rating?: number | null;
  ratingComment?: string | null;
  merchantResponse?: string | null;
  customer?: { name?: string | null };
}

interface LegacyProduct {
  id: string;
  name: string;
  category?: string | null;
  price: number;
  image?: string;
  description?: string;
  available?: boolean;
  quantityAvailable?: number | null;
  lowStockThreshold?: number | null;
}

function normalizeStatus(status: string | undefined): string {
  const key = String(status || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (key === 'READYFORPICKUP') return 'READY_FOR_PICKUP';
  if (key === 'OUTFORDELIVERY' || key === 'INTRANSIT' || key === 'ONTHEWAY') return 'OUT_FOR_DELIVERY';
  return key;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: getAuthHeaders(true),
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Request failed (${response.status})`));
  }

  return (await response.json()) as T;
}

function getMerchantStoreId(): string | undefined {
  const auth = getStoredAuth<{ storeId?: string }>();
  return auth.storeId;
}

async function fallbackMerchantGet<T>(url: string): Promise<T | null> {
  const storeId = getMerchantStoreId();

  if (url === '/api/merchant/dashboard') {
    const [orders, stores] = await Promise.all([
      fetchJson<LegacyOrder[]>('/api/orders'),
      fetchJson<Array<{ id: string; name: string; isOpen?: boolean; isActive?: boolean; busyMode?: boolean; pausedOrders?: boolean }>>('/api/stores'),
    ]);

    const scoped = storeId ? orders.filter((o: any) => o?.store?.id === storeId || o?.storeId === storeId) : orders;
    const pendingOrders = scoped.filter((o) => normalizeStatus(o.status) === 'PENDING').length;
    const completedToday = scoped.filter((o) => normalizeStatus(o.status) === 'DELIVERED').length;

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    const dayOfWeek = (dayStart.getDay() + 6) % 7;
    weekStart.setDate(dayStart.getDate() - dayOfWeek);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const delivered = scoped.filter((o) => normalizeStatus(o.status) === 'DELIVERED');
    const sumNetIncome = (rows: LegacyOrder[]) => rows.reduce((sum, order) => sum + getMerchantOrderFinancials(order).merchantNetIncome, 0);

    const todaysNetIncome = sumNetIncome(delivered.filter((o) => new Date(o.createdAt || Date.now()) >= dayStart));
    const weeklyNetIncome = sumNetIncome(delivered.filter((o) => new Date(o.createdAt || Date.now()) >= weekStart));
    const monthlyNetIncome = sumNetIncome(delivered.filter((o) => new Date(o.createdAt || Date.now()) >= monthStart));
    const totalNetIncome = sumNetIncome(delivered);

    const store = stores.find((s) => s.id === storeId);
    return {
      store,
      kpis: {
        pendingOrders,
        acceptedInProgress: scoped.filter((o) => ['PREPARING', 'ASSIGNED', 'READY_FOR_PICKUP', 'DRIVER_ACCEPTED', 'OUT_FOR_DELIVERY'].includes(normalizeStatus(o.status))).length,
        readyForPickup: scoped.filter((o) => ['ASSIGNED', 'READY_FOR_PICKUP'].includes(normalizeStatus(o.status))).length,
        completedToday,
        cancelledToday: scoped.filter((o) => normalizeStatus(o.status) === 'CANCELLED').length,
        todaysNetIncome,
        weeklyNetIncome,
        monthlyNetIncome,
        totalNetIncome,
      },
      lowStockAlerts: [],
    } as T;
  }

  if (url === '/api/merchant/inventory' && storeId) {
    const products = await fetchJson<LegacyProduct[]>(`/api/stores/${storeId}/products`);
    return products as T;
  }

  if (url === '/api/merchant/promotions') {
    const promotions = await fetchJson<any[]>('/api/promotions');
    return promotions as T;
  }

  if (url.startsWith('/api/merchant/reports/overview')) {
    const orders = await fetchJson<LegacyOrder[]>('/api/orders');
    const scoped = storeId ? orders.filter((o: any) => o?.store?.id === storeId || o?.storeId === storeId) : orders;
    const delivered = scoped.filter((o) => normalizeStatus(o.status) === 'DELIVERED');
    const netIncome = delivered.reduce((sum, order) => sum + getMerchantOrderFinancials(order).merchantNetIncome, 0);
    const daily = delivered.reduce<Record<string, number>>((acc, order) => {
      const day = (order.createdAt ? new Date(order.createdAt) : new Date()).toISOString().slice(0, 10);
      acc[day] = (acc[day] || 0) + getMerchantOrderFinancials(order).merchantNetIncome;
      return acc;
    }, {});

    return {
      summary: {
        totalOrders: scoped.length,
        deliveredOrders: delivered.length,
        cancelledOrders: scoped.filter((o) => normalizeStatus(o.status) === 'CANCELLED').length,
        acceptanceRate: scoped.length ? (((scoped.length - scoped.filter((o) => normalizeStatus(o.status) === 'CANCELLED').length) / scoped.length) * 100).toFixed(1) : '0',
        cancellationRate: scoped.length ? ((scoped.filter((o) => normalizeStatus(o.status) === 'CANCELLED').length / scoped.length) * 100).toFixed(1) : '0',
        netIncome,
        avgOrderValue: delivered.length ? netIncome / delivered.length : 0,
      },
      salesOverTime: Object.entries(daily).map(([date, total]) => ({ date, total })),
      topProducts: [],
    } as T;
  }

  if (url === '/api/merchant/payouts') {
    return {
      summary: { totalNetIncome: 0, netEarnings: 0, merchantPayout: 0, payoutDue: 0 },
      settlements: [],
    } as T;
  }

  if (url === '/api/merchant/reviews') {
    const orders = await fetchJson<LegacyOrder[]>('/api/orders');
    const scoped = storeId ? orders.filter((o: any) => o?.store?.id === storeId || o?.storeId === storeId) : orders;
    return scoped
      .filter((o) => o.rating !== null && o.rating !== undefined)
      .map((o) => ({
        id: o.id,
        rating: o.rating,
        ratingComment: o.ratingComment,
        merchantResponse: o.merchantResponse,
        createdAt: o.createdAt,
        customer: o.customer,
      })) as T;
  }

  if (url === '/api/merchant/support-tickets') {
    return [] as T;
  }

  return null;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

export async function merchantFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(true),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    if ((init?.method || 'GET').toUpperCase() === 'GET' && response.status === 404) {
      const fallback = await fallbackMerchantGet<T>(url);
      if (fallback !== null) {
        return fallback;
      }
    }

    throw new Error(await readError(response, `Request failed (${response.status})`));
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
