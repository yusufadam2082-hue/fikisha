import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { formatKES } from '../../utils/currency';
import { merchantFetch } from './merchantApi';

interface DashboardPayload {
  store: {
    id?: string;
    name?: string;
    isOpen?: boolean;
    pausedOrders?: boolean;
    busyMode?: boolean;
  };
  kpis: {
    pendingOrders: number;
    acceptedInProgress: number;
    readyForPickup: number;
    completedToday: number;
    cancelledToday: number;
    todaysNetIncome: number;
    weeklyNetIncome: number;
    monthlyNetIncome: number;
    totalNetIncome: number;
  };
  lowStockAlerts: Array<{ id: string; name: string; quantityAvailable?: number | null; lowStockThreshold?: number | null }>;
}

const emptyData: DashboardPayload = {
  store: {},
  kpis: {
    pendingOrders: 0,
    acceptedInProgress: 0,
    readyForPickup: 0,
    completedToday: 0,
    cancelledToday: 0,
    todaysNetIncome: 0,
    weeklyNetIncome: 0,
    monthlyNetIncome: 0,
    totalNetIncome: 0,
  },
  lowStockAlerts: [],
};

export function MerchantDashboard() {
  const [data, setData] = useState<DashboardPayload>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const payload = await merchantFetch<DashboardPayload>('/api/merchant/dashboard');
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div style={{ color: 'var(--error)' }}>{error}</div>;

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '20px' }}>Merchant Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">Today’s Net Income</p>
          <h3 className="text-h2">{formatKES(data.kpis.todaysNetIncome || 0)}</h3>
        </Card>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">This Week’s Net Income</p>
          <h3 className="text-h2">{formatKES(data.kpis.weeklyNetIncome || 0)}</h3>
        </Card>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">This Month’s Net Income</p>
          <h3 className="text-h2">{formatKES(data.kpis.monthlyNetIncome || 0)}</h3>
        </Card>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">Total Net Income</p>
          <h3 className="text-h2">{formatKES(data.kpis.totalNetIncome || 0)}</h3>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">Pending Orders</p>
          <h3 className="text-h2">{data.kpis.pendingOrders}</h3>
        </Card>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">In Progress</p>
          <h3 className="text-h2">{data.kpis.acceptedInProgress}</h3>
        </Card>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">Ready for Pickup</p>
          <h3 className="text-h2">{data.kpis.readyForPickup}</h3>
        </Card>
        <Card style={{ padding: '18px' }}>
          <p className="text-sm text-muted">Completed Today</p>
          <h3 className="text-h2">{data.kpis.completedToday}</h3>
        </Card>
      </div>

      <Card style={{ padding: '18px', marginBottom: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '8px' }}>Store Status</h3>
        <p className="text-sm text-muted">
          {data.store.name || 'Store'}: {data.store.isOpen ? 'Open' : 'Closed'} | Orders: {data.store.pausedOrders ? 'Paused' : 'Receiving'} | Mode: {data.store.busyMode ? 'Busy' : 'Normal'}
        </p>
      </Card>

      <Card style={{ padding: '18px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>Low Stock Alerts</h3>
        {data.lowStockAlerts.length === 0 ? (
          <p className="text-sm text-muted">No low stock alerts.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {data.lowStockAlerts.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.name}</span>
                <span className="text-sm text-muted">
                  {item.quantityAvailable ?? 0} left (threshold {item.lowStockThreshold ?? 5})
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
