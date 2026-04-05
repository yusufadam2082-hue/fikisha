import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authStorage';
import { formatKES } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_PERMISSION_KEYS } from '../../utils/adminRbac';

type OverviewPayload = {
  totalOrders?: number;
  deliveredOrders?: number;
  completionRate?: number | string;
  gmv?: number;
  fees?: number;
  aov?: number;
};

export function ReportsOverview() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await fetch(apiUrl('/api/admin/reports/overview'), { headers: getAuthHeaders(false) });
      if (!response.ok) {
        throw new Error('Failed to load reports overview');
      }
      setData(await response.json());
    };

    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load reports overview'));
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-h1" style={{ marginBottom: '8px' }}>Reports</h1>
          <p className="text-muted">Platform performance and finance-facing reporting summary.</p>
        </div>
        {hasPermission(ADMIN_PERMISSION_KEYS.exportReports) ? <Button variant="outline">Export coming next</Button> : null}
      </div>
      {message ? <p className="text-sm" style={{ marginBottom: '16px', color: 'var(--error)' }}>{message}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '20px' }} hoverable={false}><p className="text-sm text-muted">Total Orders</p><h2 className="text-h2">{data?.totalOrders ?? '-'}</h2></Card>
        <Card style={{ padding: '20px' }} hoverable={false}><p className="text-sm text-muted">Delivered Orders</p><h2 className="text-h2">{data?.deliveredOrders ?? '-'}</h2></Card>
        <Card style={{ padding: '20px' }} hoverable={false}><p className="text-sm text-muted">Completion Rate</p><h2 className="text-h2">{data?.completionRate ?? '-'}%</h2></Card>
        <Card style={{ padding: '20px' }} hoverable={false}><p className="text-sm text-muted">GMV</p><h2 className="text-h2">{formatKES(Number(data?.gmv || 0))}</h2></Card>
        <Card style={{ padding: '20px' }} hoverable={false}><p className="text-sm text-muted">Platform Fees</p><h2 className="text-h2">{formatKES(Number(data?.fees || 0))}</h2></Card>
        <Card style={{ padding: '20px' }} hoverable={false}><p className="text-sm text-muted">Average Order Value</p><h2 className="text-h2">{formatKES(Number(data?.aov || 0))}</h2></Card>
      </div>
    </div>
  );
}
