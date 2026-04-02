import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatKES } from '../../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';
import { apiUrl } from '../../utils/apiUrl';

interface PendingOrder {
  id: string;
  orderNumber: string;
  customerTotal: number;
  merchantNetIncome: number;
  deliveryFee: number;
  platformFee: number;
  createdAt: string;
  deliveredAt: string;
}

interface PendingStore {
  storeId: string;
  storeName: string;
  orders: PendingOrder[];
  totalMerchantAmount: number;
  totalDeliveryFees: number;
  orderCount: number;
}

interface PendingPayload {
  stores: PendingStore[];
  grandTotal: number;
  totalOrders: number;
}

interface SettlementRecord {
  id: string;
  type?: string;
  storeName?: string;
  driverName?: string;
  amount: number;
  note?: string;
  createdAt: string;
  cycleKey?: string | null;
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(false);
}

export function AdminPayouts() {
  const [pending, setPending] = useState<PendingPayload>({ stores: [], grandTotal: 0, totalOrders: 0 });
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [settleStore, setSettleStore] = useState<PendingStore | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleMessage, setSettleMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const [pendingRes, settledRes] = await Promise.all([
        fetch(apiUrl(`/api/accounting/payouts/pending?${params}`), { headers: getAuthHeaders() }),
        fetch(apiUrl('/api/accounting/payouts'), { headers: getAuthHeaders() }),
      ]);

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPending(pendingData);
      }

      if (settledRes.ok) {
        const settledData = await settledRes.json();
        setSettlements(Array.isArray(settledData) ? settledData : []);
      }
    } catch {
      setError('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const merchantSettlements = useMemo(
    () => settlements.filter((s) => s.type === 'MERCHANT_SETTLEMENT'),
    [settlements]
  );

  const totalSettled = useMemo(
    () => merchantSettlements.reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [merchantSettlements]
  );

  function openSettle(store: PendingStore) {
    setSettleStore(store);
    setSettleAmount(store.totalMerchantAmount.toFixed(2));
    setSettleNote('');
    setSettleMessage('');
  }

  async function handleSettle(event: FormEvent) {
    event.preventDefault();
    if (!settleStore || settling) return;
    setSettling(true);
    setSettleMessage('');

    try {
      const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const to = toDate || new Date().toISOString().slice(0, 10);

      const res = await fetch(apiUrl('/api/accounting/payouts/settle'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: settleStore.storeId,
          from,
          to,
          amount: Number(settleAmount),
          note: settleNote.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Settlement failed');
      }

      const result = await res.json();
      setSettleMessage(`Settled ${formatKES(Number(settleAmount))} for ${settleStore.storeName} (${result.ordersSettled} orders)`);
      setSettleStore(null);
      await load();
    } catch (err) {
      setSettleMessage(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Payout Management</h1>
      <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>
        Settle merchant earnings for a period. No auto-settlement — you control when payouts happen.
      </p>

      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}
      {settleMessage && <p style={{ color: 'var(--primary)', marginBottom: '10px', fontWeight: 600 }}>{settleMessage}</p>}

      {/* Date filter */}
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label className="text-sm text-muted">From</label>
            <input className="input-field" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted">To</label>
            <input className="input-field" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => { setFromDate(''); setToDate(''); setTimeout(() => load(), 0); }}>Clear</Button>
          <Button onClick={() => load()}>Apply Filter</Button>
        </div>
      </Card>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Card style={{ padding: '16px' }}>
          <p className="text-sm text-muted">Pending Balance</p>
          <h3 className="text-h2" style={{ color: '#b45309' }}>{formatKES(pending.grandTotal)}</h3>
          <p className="text-sm text-muted">{pending.totalOrders} orders across {pending.stores.length} stores</p>
        </Card>
        <Card style={{ padding: '16px' }}>
          <p className="text-sm text-muted">Total Settled</p>
          <h3 className="text-h2" style={{ color: '#0f766e' }}>{formatKES(totalSettled)}</h3>
          <p className="text-sm text-muted">{merchantSettlements.length} settlement records</p>
        </Card>
      </div>

      {/* Pending by store */}
      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>Pending Earnings by Store</h3>
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : pending.stores.length === 0 ? (
          <p className="text-sm text-muted">No pending payouts. All delivered orders are settled.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {pending.stores.map((store) => (
              <div key={store.storeId} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div className="flex-between" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong>{store.storeName}</strong>
                    <span className="text-sm text-muted" style={{ marginLeft: '8px' }}>{store.orderCount} orders</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700, color: '#b45309' }}>{formatKES(store.totalMerchantAmount)}</span>
                    <Button size="sm" onClick={() => openSettle(store)}>Settle</Button>
                  </div>
                </div>
                <details>
                  <summary className="text-sm" style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>View {store.orderCount} orders</summary>
                  <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
                    {store.orders.map((order) => (
                      <div key={order.id} className="flex-between text-sm" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{order.orderNumber.slice(0, 8)} • {new Date(order.deliveredAt).toLocaleDateString()}</span>
                        <span>{formatKES(order.merchantNetIncome)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Settlement history */}
      <Card style={{ padding: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>Settlement History</h3>
        {merchantSettlements.length === 0 ? (
          <p className="text-sm text-muted">No settlements recorded yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {merchantSettlements.map((record) => (
              <div key={record.id} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong>{record.storeName || 'Store'}</strong>
                  <p className="text-sm text-muted">{record.note || 'Settlement'} • {new Date(record.createdAt).toLocaleString()}</p>
                </div>
                <span style={{ fontWeight: 700, color: '#0f766e' }}>{formatKES(Number(record.amount || 0))}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Settle modal */}
      {settleStore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <Card style={{ padding: '24px', width: '100%', maxWidth: '420px', margin: '16px' }}>
            <h3 className="text-h3" style={{ marginBottom: '16px' }}>Settle {settleStore.storeName}</h3>
            <p className="text-sm text-muted" style={{ marginBottom: '12px' }}>
              {settleStore.orderCount} pending orders • Total pending: {formatKES(settleStore.totalMerchantAmount)}
            </p>
            <form onSubmit={handleSettle} style={{ display: 'grid', gap: '10px' }}>
              <div>
                <label className="text-sm text-muted">Amount (KES)</label>
                <input className="input-field" type="number" step="0.01" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm text-muted">Note (optional)</label>
                <input className="input-field" placeholder="e.g. Week 14 settlement" value={settleNote} onChange={(e) => setSettleNote(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={() => setSettleStore(null)}>Cancel</Button>
                <Button type="submit" disabled={settling}>{settling ? 'Settling...' : 'Confirm Settlement'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
