import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authStorage';
import { formatKES } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_PERMISSION_KEYS } from '../../utils/adminRbac';

type OrderRow = {
  id: string;
  orderNumber?: string | null;
  status: string;
  total: number;
  createdAt: string;
  store?: { name?: string };
  customer?: { name?: string };
};

export function OrdersAdmin() {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl('/api/admin/orders'), { headers: getAuthHeaders(false) });
      if (!response.ok) {
        throw new Error('Failed to load orders');
      }
      setOrders(await response.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  const performAction = async (id: string, action: 'cancel' | 'refund') => {
    const reason = window.prompt(`Enter ${action} reason`);
    if (!reason) return;

    const response = await fetch(apiUrl(`/api/admin/orders/${id}/${action}`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || `Failed to ${action} order`);
      return;
    }

    setMessage(`Order ${action}ed successfully.`);
    await fetchOrders();
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Orders</h1>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Operational order oversight with permission-aware actions.</p>
      {message ? <p className="text-sm" style={{ marginBottom: '16px', color: message.toLowerCase().includes('failed') ? 'var(--error)' : 'var(--primary)' }}>{message}</p> : null}
      <Card style={{ padding: '20px' }} hoverable={false}>
        {loading ? (
          <p className="text-sm text-muted">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted">No orders found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {orders.map((order) => (
              <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <div>
                    <strong>{order.orderNumber || order.id.slice(0, 8)}</strong>
                    <p className="text-sm text-muted" style={{ marginBottom: 0 }}>{order.store?.name || 'Unknown store'} • {order.customer?.name || 'Unknown customer'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700 }}>{formatKES(Number(order.total || 0))}</p>
                    <p className="text-sm text-muted" style={{ marginBottom: 0 }}>{String(order.status || '').replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
                  <p className="text-sm text-muted" style={{ marginBottom: 0 }}>{new Date(order.createdAt).toLocaleString()}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {hasPermission(ADMIN_PERMISSION_KEYS.cancelOrders) ? <Button size="sm" variant="outline" onClick={() => performAction(order.id, 'cancel')}>Cancel</Button> : null}
                    {hasPermission(ADMIN_PERMISSION_KEYS.refundOrders) ? <Button size="sm" variant="outline" onClick={() => performAction(order.id, 'refund')}>Refund</Button> : null}
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
