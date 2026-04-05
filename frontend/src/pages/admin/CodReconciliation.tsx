import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authStorage';
import { formatKES } from '../../utils/currency';

type SummaryPayload = {
  merchant?: { pendingTotal?: number; paidTotal?: number; heldTotal?: number };
  driver?: { pendingTotal?: number; paidTotal?: number; heldTotal?: number };
  totals?: { pending?: number; paid?: number; held?: number };
};

export function CodReconciliation() {
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await fetch(apiUrl('/api/admin/payout-reconciliation/summary'), { headers: getAuthHeaders(false) });
      if (!response.ok) {
        throw new Error('Failed to load reconciliation summary');
      }
      setSummary(await response.json());
    };

    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load reconciliation summary'));
  }, []);

  const cards = [
    { label: 'Pending', value: Number(summary?.totals?.pending || 0), color: '#b45309' },
    { label: 'Paid', value: Number(summary?.totals?.paid || 0), color: '#0f766e' },
    { label: 'Held', value: Number(summary?.totals?.held || 0), color: '#dc2626' }
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>COD Reconciliation</h1>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Finance visibility into pending, held, and paid settlement totals.</p>
      {message ? <p className="text-sm" style={{ marginBottom: '16px', color: 'var(--error)' }}>{message}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
        {cards.map((card) => (
          <Card key={card.label} style={{ padding: '20px' }} hoverable={false}>
            <p className="text-sm text-muted">{card.label}</p>
            <h2 className="text-h2" style={{ color: card.color }}>{formatKES(card.value)}</h2>
          </Card>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '20px' }} hoverable={false}>
          <h3 className="text-h3" style={{ marginBottom: '10px' }}>Merchants</h3>
          <p className="text-sm text-muted">Pending: {formatKES(Number(summary?.merchant?.pendingTotal || 0))}</p>
          <p className="text-sm text-muted">Paid: {formatKES(Number(summary?.merchant?.paidTotal || 0))}</p>
          <p className="text-sm text-muted">Held: {formatKES(Number(summary?.merchant?.heldTotal || 0))}</p>
        </Card>
        <Card style={{ padding: '20px' }} hoverable={false}>
          <h3 className="text-h3" style={{ marginBottom: '10px' }}>Drivers</h3>
          <p className="text-sm text-muted">Pending: {formatKES(Number(summary?.driver?.pendingTotal || 0))}</p>
          <p className="text-sm text-muted">Paid: {formatKES(Number(summary?.driver?.paidTotal || 0))}</p>
          <p className="text-sm text-muted">Held: {formatKES(Number(summary?.driver?.heldTotal || 0))}</p>
        </Card>
      </div>
    </div>
  );
}
