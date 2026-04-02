import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { formatKES } from '../../utils/currency';
import { merchantFetch } from './merchantApi';

interface PayoutRow {
  id?: string;
  orderId?: string | null;
  amount: number;
  createdAt: string;
  type?: string;
  note?: string | null;
  orderCount?: number | null;
}

interface PayoutPayload {
  summary: {
    totalSettled: number;
    pendingBalance: number;
    totalEarnings: number;
  };
  settlements: PayoutRow[];
}

const initialPayout: PayoutPayload = {
  summary: { totalSettled: 0, pendingBalance: 0, totalEarnings: 0 },
  settlements: [],
};

export function MerchantPayouts() {
  const [payload, setPayload] = useState<PayoutPayload>(initialPayout);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await merchantFetch<PayoutPayload>('/api/merchant/payouts');
        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payouts');
      }
    }

    void load();
  }, []);

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Payouts</h1>
      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Total Earnings</p><h3 className="text-h2">{formatKES(payload.summary.totalEarnings)}</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Settled (Paid Out)</p><h3 className="text-h2" style={{ color: '#0f766e' }}>{formatKES(payload.summary.totalSettled)}</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Pending Balance</p><h3 className="text-h2" style={{ color: '#b45309' }}>{formatKES(payload.summary.pendingBalance)}</h3></Card>
      </div>
      <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>Pending balance is paid out by the admin on a settlement schedule. Not included: Delivery fees.</p>

        <Card style={{ padding: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '10px' }}>Settlement Ledger</h3>
        {payload.settlements.length === 0 ? <p className="text-sm text-muted">No settlements yet.</p> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {payload.settlements.map((row, index) => (
              <div key={`${row.id || row.orderId || 'row'}-${index}`} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <div className="flex-between">
                  <span style={{ fontWeight: 600 }}>{formatKES(row.amount)}</span>
                  <span className="text-sm text-muted">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                {row.note && <p className="text-sm text-muted" style={{ marginTop: '2px' }}>{row.note}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
