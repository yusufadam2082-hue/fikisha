import { useEffect, useMemo, useState } from 'react';
import { useStoreContext } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Store, ShoppingBag, Users, TrendingUp, Wallet } from 'lucide-react';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';
import { formatKES } from '../../utils/currency';
import { apiUrl } from '../../utils/apiUrl';

interface SettlementRecord {
  id: string;
  type?: string;
  orderId?: string | null;
  storeName?: string;
  driverName?: string;
  cycleKey?: string | null;
  amount: number;
  note?: string;
  createdAt: string;
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(false);
}

export function AdminDashboard() {
  const { stores } = useStoreContext();
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(true);

  useEffect(() => {
    const fetchSettlements = async () => {
      try {
        const response = await fetch(apiUrl('/api/accounting/payouts'), { headers: getAuthHeaders() });
        if (!response.ok || response.status === 204) {
          return;
        }

        const payload = await response.json();
        if (Array.isArray(payload)) {
          setSettlements(payload);
        }
      } catch {
        // Keep dashboard functional if payouts endpoint is temporarily unavailable.
      } finally {
        setLoadingSettlements(false);
      }
    };

    void fetchSettlements();
  }, []);

  const settlementSummary = useMemo(() => {
    const merchantSettlements = settlements.filter((record) => record.type === 'MERCHANT_SETTLEMENT');
    const driverPayouts = settlements.filter((record) => record.type === 'DRIVER_PAYOUT');
    const totalSettled = settlements.reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const recent = settlements.slice(0, 8);

    return {
      merchantTotal: merchantSettlements.reduce((sum, record) => sum + Number(record.amount || 0), 0),
      driverTotal: driverPayouts.reduce((sum, record) => sum + Number(record.amount || 0), 0),
      totalSettled,
      recent,
      recordCount: settlements.length
    };
  }, [settlements]);

  const stats = [
    { name: 'Active Stores', value: stores.length.toString(), icon: Store, color: 'var(--primary)' },
    { name: 'Total Orders', value: '1,284', icon: ShoppingBag, color: '#3b82f6' },
    { name: 'Active Users', value: '3,492', icon: Users, color: '#8b5cf6' },
    { name: 'Revenue', value: 'KES 42.5k', icon: TrendingUp, color: '#22c55e' },
    { name: 'Settlements', value: settlementSummary.recordCount.toString(), icon: Wallet, color: '#0f766e' }
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Admin Overview</h1>
      <p className="text-muted" style={{ marginBottom: '32px' }}>Welcome back. Here's what's happening today.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '24px' }} hoverable={false}>
              <div style={{ padding: '16px', background: `${stat.color}15`, color: stat.color, borderRadius: 'var(--radius-lg)' }}>
                <Icon size={32} />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted" style={{ marginBottom: '4px' }}>{stat.name}</p>
                <h2 className="text-h1" style={{ fontSize: '2rem' }}>{stat.value}</h2>
              </div>
            </Card>
          );
        })}
      </div>

      <Card style={{ padding: '24px' }} hoverable={false}>
        <div className="flex-between" style={{ marginBottom: '18px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 className="text-h2" style={{ marginBottom: '4px' }}>Settlement Records</h2>
            <p className="text-sm text-muted">Automatic merchant settlements and driver payouts recorded after order closure.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="text-sm text-muted">Total settled</p>
            <p className="text-h3" style={{ color: '#0f766e' }}>{formatKES(settlementSummary.totalSettled)}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          <Card style={{ padding: '12px' }} hoverable={false}>
            <p className="text-sm text-muted">Merchant settlements</p>
            <p className="text-h3">{formatKES(settlementSummary.merchantTotal)}</p>
          </Card>
          <Card style={{ padding: '12px' }} hoverable={false}>
            <p className="text-sm text-muted">Driver payouts</p>
            <p className="text-h3">{formatKES(settlementSummary.driverTotal)}</p>
          </Card>
          <Card style={{ padding: '12px' }} hoverable={false}>
            <p className="text-sm text-muted">Records</p>
            <p className="text-h3">{settlementSummary.recordCount}</p>
          </Card>
        </div>

        {loadingSettlements ? (
          <p className="text-sm text-muted">Loading settlement records...</p>
        ) : settlementSummary.recent.length === 0 ? (
          <p className="text-sm text-muted">No settlements recorded yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {settlementSummary.recent.map((record) => (
              <div key={record.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                <div className="flex-between" style={{ marginBottom: '6px' }}>
                  <p style={{ fontWeight: 700 }}>
                    {(record.type || 'SETTLEMENT').replace(/_/g, ' ')}
                  </p>
                  <p style={{ fontWeight: 700, color: '#0f766e' }}>{formatKES(Number(record.amount || 0))}</p>
                </div>
                <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>
                  {record.storeName || 'Store'}{record.driverName ? ` • ${record.driverName}` : ''}{record.orderId ? ` • Order ${record.orderId.slice(0, 8)}` : ''}
                </p>
                <p className="text-sm text-muted">{new Date(record.createdAt).toLocaleString()} • {record.note || 'Settlement recorded'}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
