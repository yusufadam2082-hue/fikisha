import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { formatKES } from '../../utils/currency';
import { merchantFetch } from './merchantApi';

interface PayoutRow {
  id?: string;
  orderId?: string;
  amount: number;
  createdAt: string;
  type?: string;
}

interface PayoutPayload {
  summary: {
    grossSales: number;
    netEarnings: number;
    payoutDue: number;
  };
  settlements: PayoutRow[];
}

const initialPayout: PayoutPayload = {
  summary: { grossSales: 0, netEarnings: 0, payoutDue: 0 },
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
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Gross Sales</p><h3 className="text-h2">{formatKES(payload.summary.grossSales)}</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Net Earnings</p><h3 className="text-h2">{formatKES(payload.summary.netEarnings)}</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Payout Due</p><h3 className="text-h2">{formatKES(payload.summary.payoutDue)}</h3></Card>
      </div>

      <Card style={{ padding: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '10px' }}>Settlement Ledger</h3>
        {payload.settlements.length === 0 ? <p className="text-sm text-muted">No settlements yet.</p> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {payload.settlements.map((row, index) => (
              <div key={`${row.orderId || 'row'}-${index}`} className="flex-between">
                <span>{new Date(row.createdAt).toLocaleString()}</span>
                <span>{formatKES(row.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
