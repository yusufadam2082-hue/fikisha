import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatKES } from '../../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';
import { apiUrl } from '../../utils/apiUrl';

type PayoutStatus = 'PENDING' | 'PAID' | 'HELD' | 'REVERSED';
type PayoutTab = 'merchant' | 'driver';

interface EntryRow {
  id: string;
  orderId: string;
  amount: number;
  status: PayoutStatus;
  createdAt: string;
}

interface MerchantRecipient {
  storeId: string;
  storeName: string;
  pendingBalance: number;
  paidBalance: number;
  payableOrdersCount: number;
  deliveredOrdersCount: number;
  lastPayoutDate: string | null;
  entries: EntryRow[];
}

interface DriverRecipient {
  driverId: string;
  driverName: string;
  pendingBalance: number;
  paidBalance: number;
  completedDeliveriesCount: number;
  lastPayoutDate: string | null;
  entries: EntryRow[];
}

interface PayoutBatch {
  id: string;
  type: 'MERCHANT' | 'DRIVER';
  recipientId: string;
  recipientType: string;
  totalAmount: number;
  status: PayoutStatus;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  paidAt?: string | null;
  items?: Array<{ id: string }>;
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(false);
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error || fallback;
  } catch {
    return fallback;
  }
}

export function AdminPayouts() {
  const [activeTab, setActiveTab] = useState<PayoutTab>('merchant');
  const [merchantRows, setMerchantRows] = useState<MerchantRecipient[]>([]);
  const [driverRows, setDriverRows] = useState<DriverRecipient[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [recipientId, setRecipientId] = useState('');
  const [orderIdsText, setOrderIdsText] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [message, setMessage] = useState('');

  const rows = activeTab === 'merchant' ? merchantRows : driverRows;

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    if (activeTab === 'merchant') {
      return (rows as MerchantRecipient[]).filter((row) => row.storeName.toLowerCase().includes(keyword));
    }

    return (rows as DriverRecipient[]).filter((row) => row.driverName.toLowerCase().includes(keyword));
  }, [activeTab, rows, search]);

  const pendingTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.pendingBalance || 0), 0),
    [rows]
  );

  const paidTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.paidBalance || 0), 0),
    [rows]
  );

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const [merchantRes, driverRes, batchRes] = await Promise.all([
        fetch(apiUrl(`/api/admin/payout-center/merchants?${params}`), { headers: getAuthHeaders() }),
        fetch(apiUrl(`/api/admin/payout-center/drivers?${params}`), { headers: getAuthHeaders() }),
        fetch(apiUrl('/api/admin/payout-batches'), { headers: getAuthHeaders() })
      ]);

      if (!merchantRes.ok) {
        throw new Error(await readError(merchantRes, 'Failed to load merchant payout data'));
      }
      if (!driverRes.ok) {
        throw new Error(await readError(driverRes, 'Failed to load driver payout data'));
      }

      const merchantPayload = await merchantRes.json();
      const driverPayload = await driverRes.json();
      setMerchantRows(Array.isArray(merchantPayload) ? merchantPayload : []);
      setDriverRows(Array.isArray(driverPayload) ? driverPayload : []);

      if (batchRes.ok) {
        const batchPayload = await batchRes.json();
        setBatches(Array.isArray(batchPayload) ? batchPayload : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout center data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [fromDate, toDate]);

  function prepareBatchFromRecipient(row: MerchantRecipient | DriverRecipient) {
    const entries = row.entries || [];
    const pendingOrderIds = entries.filter((entry) => entry.status === 'PENDING').map((entry) => entry.orderId);
    setRecipientId(activeTab === 'merchant' ? (row as MerchantRecipient).storeId : (row as DriverRecipient).driverId);
    setOrderIdsText(pendingOrderIds.join(', '));
    setReference('');
    setNotes('');
    setMessage('');
  }

  async function handleCreateBatch(event: FormEvent) {
    event.preventDefault();
    if (isCreatingBatch) return;

    const orderIds = orderIdsText.split(',').map((value) => value.trim()).filter(Boolean);
    if (!recipientId || orderIds.length === 0) {
      setMessage('Recipient and at least one order ID are required.');
      return;
    }

    setIsCreatingBatch(true);
    setMessage('');

    try {
      const res = await fetch(apiUrl('/api/admin/payout-batches'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab === 'merchant' ? 'MERCHANT' : 'DRIVER',
          recipientId,
          orderIds,
          reference: reference.trim() || null,
          notes: notes.trim() || null
        })
      });

      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to create payout batch'));
      }

      const payload = await res.json();
      setMessage(`Created batch ${payload?.batch?.id || ''}`.trim());
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create payout batch');
    } finally {
      setIsCreatingBatch(false);
    }
  }

  async function updateBatchStatus(batchId: string, action: 'mark-paid' | 'hold' | 'reverse') {
    try {
      const res = await fetch(apiUrl(`/api/admin/payout-batches/${batchId}/${action}`), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to update payout batch status'));
      }

      await loadData();
      setMessage(`Batch ${batchId.slice(0, 8)} updated (${action}).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update payout batch status');
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Admin Payout Center</h1>
      <p className="text-sm text-muted" style={{ marginBottom: '14px' }}>
        Manual payouts only. Create payout batches from pending delivered orders, then mark batch status.
      </p>

      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}
      {message && <p style={{ color: 'var(--primary)', marginBottom: '10px', fontWeight: 600 }}>{message}</p>}

      <Card style={{ padding: '14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <Button variant={activeTab === 'merchant' ? 'primary' : 'outline'} onClick={() => setActiveTab('merchant')}>Merchant Payouts</Button>
          <Button variant={activeTab === 'driver' ? 'primary' : 'outline'} onClick={() => setActiveTab('driver')}>Driver Payouts</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <div>
            <label className="text-sm text-muted">Search</label>
            <input className="input-field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={activeTab === 'merchant' ? 'Store name' : 'Driver name'} />
          </div>
          <div>
            <label className="text-sm text-muted">From</label>
            <input className="input-field" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted">To</label>
            <input className="input-field" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <Button variant="secondary" onClick={() => { setSearch(''); setFromDate(''); setToDate(''); }}>Clear Filters</Button>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <Card style={{ padding: '16px' }}>
          <p className="text-sm text-muted">Pending Balance</p>
          <h3 className="text-h2" style={{ color: '#b45309' }}>{formatKES(pendingTotal)}</h3>
        </Card>
        <Card style={{ padding: '16px' }}>
          <p className="text-sm text-muted">Paid Balance</p>
          <h3 className="text-h2" style={{ color: '#0f766e' }}>{formatKES(paidTotal)}</h3>
        </Card>
        <Card style={{ padding: '16px' }}>
          <p className="text-sm text-muted">Recipients</p>
          <h3 className="text-h2">{filteredRows.length}</h3>
        </Card>
      </div>

      <Card style={{ padding: '16px', marginBottom: '14px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>
          {activeTab === 'merchant' ? 'Merchant ledgers' : 'Driver ledgers'}
        </h3>
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted">No records found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredRows.map((row) => {
              const isMerchant = activeTab === 'merchant';
              const id = isMerchant ? (row as MerchantRecipient).storeId : (row as DriverRecipient).driverId;
              const name = isMerchant ? (row as MerchantRecipient).storeName : (row as DriverRecipient).driverName;
              const pending = Number(row.pendingBalance || 0);
              const count = isMerchant ? (row as MerchantRecipient).payableOrdersCount : (row as DriverRecipient).completedDeliveriesCount;

              return (
                <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                  <div className="flex-between" style={{ gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{name}</strong>
                      <p className="text-sm text-muted" style={{ marginBottom: 0 }}>{count} orders/deliveries</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, color: '#b45309' }}>{formatKES(pending)}</p>
                      <Button size="sm" onClick={() => prepareBatchFromRecipient(row)}>Create Batch</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ padding: '16px', marginBottom: '14px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>Create Payout Batch</h3>
        <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div>
              <label className="text-sm text-muted">Recipient ID</label>
              <input className="input-field" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} placeholder={activeTab === 'merchant' ? 'Store ID' : 'Driver ID'} />
            </div>
            <div>
              <label className="text-sm text-muted">Reference</label>
              <input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Payment reference" />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted">Order IDs (comma-separated)</label>
            <textarea className="input-field" rows={3} value={orderIdsText} onChange={(e) => setOrderIdsText(e.target.value)} placeholder="order-id-1, order-id-2" />
          </div>
          <div>
            <label className="text-sm text-muted">Notes</label>
            <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" disabled={isCreatingBatch}>{isCreatingBatch ? 'Creating...' : 'Create Batch'}</Button>
          </div>
        </form>
      </Card>

      <Card style={{ padding: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>Batch History</h3>
        {batches.length === 0 ? (
          <p className="text-sm text-muted">No payout batches yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {batches.map((batch) => (
              <div key={batch.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div className="flex-between" style={{ gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{batch.type} batch</strong>
                    <p className="text-sm text-muted" style={{ marginBottom: '2px' }}>
                      {batch.id.slice(0, 8)} - {new Date(batch.createdAt).toLocaleString()} - {batch.status}
                    </p>
                    <p className="text-sm text-muted" style={{ marginBottom: 0 }}>Items: {batch.items?.length || 0} - Recipient: {batch.recipientId}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700 }}>{formatKES(Number(batch.totalAmount || 0))}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {batch.status !== 'PAID' && (
                        <Button size="sm" onClick={() => updateBatchStatus(batch.id, 'mark-paid')}>Mark Paid</Button>
                      )}
                      {batch.status !== 'HELD' && batch.status !== 'PAID' && (
                        <Button size="sm" variant="secondary" onClick={() => updateBatchStatus(batch.id, 'hold')}>Hold</Button>
                      )}
                      {batch.status !== 'REVERSED' && (
                        <Button size="sm" variant="outline" onClick={() => updateBatchStatus(batch.id, 'reverse')}>Reverse</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
