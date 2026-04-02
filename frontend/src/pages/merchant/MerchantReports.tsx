import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { formatKES } from '../../utils/currency';
import { merchantFetch } from './merchantApi';

interface ReportsData {
  summary: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    acceptanceRate: string;
    cancellationRate: string;
    netIncome: number;
    avgOrderValue: number;
  };
  salesOverTime: Array<{ date: string; total: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
}

const initialData: ReportsData = {
  summary: {
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    acceptanceRate: '0',
    cancellationRate: '0',
    netIncome: 0,
    avgOrderValue: 0,
  },
  salesOverTime: [],
  topProducts: [],
};

export function MerchantReports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportsData>(initialData);
  const [error, setError] = useState('');

  async function load() {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      const payload = await merchantFetch<ReportsData>(`/api/merchant/reports/overview${query ? `?${query}` : ''}`);
      setData(payload);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '16px', gap: '8px', flexWrap: 'wrap' }}>
        <h1 className="text-h1">Reports</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input-field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn-primary" style={{ border: 'none', borderRadius: '999px', padding: '10px 18px' }} onClick={() => void load()}>Apply</button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Net Income</p><h3 className="text-h2">{formatKES(data.summary.netIncome)}</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Orders</p><h3 className="text-h2">{data.summary.totalOrders}</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Acceptance Rate</p><h3 className="text-h2">{data.summary.acceptanceRate}%</h3></Card>
        <Card style={{ padding: '16px' }}><p className="text-sm text-muted">Average Net Income / Order</p><h3 className="text-h2">{formatKES(data.summary.avgOrderValue)}</h3></Card>
      </div>
      <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>Not included in your earnings: Delivery Fee</p>

      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '10px' }}>Net Income Timeline</h3>
        {data.salesOverTime.length === 0 ? <p className="text-sm text-muted">No sales in selected range.</p> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {data.salesOverTime.map((row) => (
              <div key={row.date} className="flex-between">
                <span>{row.date}</span>
                <span>{formatKES(row.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ padding: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '10px' }}>Top Products</h3>
        {data.topProducts.length === 0 ? <p className="text-sm text-muted">No delivered sales yet.</p> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {data.topProducts.map((item) => (
              <div key={item.name} className="flex-between">
                <span>{item.name}</span>
                <span className="text-sm text-muted">{item.qty} sold | {formatKES(item.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
