import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BellRing, BarChart3, Clock, DollarSign, ShoppingBag, Store as StoreIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatKES } from '../../utils/currency';

function getAuthHeaders(): HeadersInit {
  const auth = JSON.parse(localStorage.getItem('fikisha_auth') || '{}');
  return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

function normalizeOrderStatus(status: string): string {
  const key = String(status || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');

  if (key === 'READYFORPICKUP') return 'READY_FOR_PICKUP';
  if (key === 'OUTFORDELIVERY' || key === 'INTRANSIT' || key === 'ONTHEWAY') return 'OUT_FOR_DELIVERY';
  return key;
}

export function MerchantOrders() {
  const { user } = useAuth();
  const { stores, updateStore } = useStoreContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ringingOrderIds, setRingingOrderIds] = useState<string[]>([]);
  const [isTogglingStore, setIsTogglingStore] = useState(false);
  const [storeStatusMessage, setStoreStatusMessage] = useState('');

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

  const merchantStore = stores.find((store) => store.id === user?.storeId);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: getAuthHeaders()
      });
      if (res.ok && res.status !== 204) {
        const nextOrders = await res.json();
        const storeScopedOrders = user?.storeId
          ? nextOrders.filter((order: any) => order?.store?.id === user.storeId)
          : nextOrders;
        setOrders(storeScopedOrders);

        const pendingOrderIds = new Set(
          storeScopedOrders
            .filter((order: any) => normalizeOrderStatus(order.status) === 'PENDING')
            .map((order: any) => order.id)
        );

        setRingingOrderIds((previousIds) => previousIds.filter((id) => pendingOrderIds.has(id)));

        if (!initializedRef.current) {
          storeScopedOrders.forEach((order: any) => knownOrderIdsRef.current.add(order.id));
          initializedRef.current = true;
          return;
        }

        const newlyArrivedPendingIds = storeScopedOrders
          .filter((order: any) => normalizeOrderStatus(order.status) === 'PENDING' && !knownOrderIdsRef.current.has(order.id))
          .map((order: any) => order.id);

        if (newlyArrivedPendingIds.length > 0) {
          setRingingOrderIds((previousIds) => Array.from(new Set([...previousIds, ...newlyArrivedPendingIds])));
        }

        storeScopedOrders.forEach((order: any) => knownOrderIdsRef.current.add(order.id));
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.storeId) {
      fetchOrders();
      // Simple poll every 10 seconds for real-time feel
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.storeId]);

  const playRingTone = async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.35);
    } catch (error) {
      console.error('Unable to play merchant order alert tone:', error);
    }
  };

  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (ringingOrderIds.length === 0) {
      stopRinging();
      return;
    }

    if (!ringIntervalRef.current) {
      void playRingTone();
      ringIntervalRef.current = setInterval(() => {
        void playRingTone();
      }, 1300);
    }
  }, [ringingOrderIds.length]);

  useEffect(() => {
    return () => {
      stopRinging();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchOrders(); // refresh
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStoreOpen = async () => {
    if (!merchantStore?.id) {
      return;
    }

    const currentlyOpen = merchantStore.isOpen !== false;
    setStoreStatusMessage('');
    setIsTogglingStore(true);

    try {
      await updateStore(merchantStore.id, { isOpen: !currentlyOpen });
      setStoreStatusMessage(!currentlyOpen ? 'Store is now OPEN and visible for new orders.' : 'Store is now CLOSED for new orders.');
    } catch (error) {
      setStoreStatusMessage(error instanceof Error ? error.message : 'Failed to update store status');
    } finally {
      setIsTogglingStore(false);
    }
  };

  const performance = useMemo(() => {
    const normalized = orders.map((order) => ({
      ...order,
      normalizedStatus: normalizeOrderStatus(order.status)
    }));

    const pending = normalized.filter((order) => order.normalizedStatus === 'PENDING');
    const cancelled = normalized.filter((order) => order.normalizedStatus === 'CANCELLED');
    const delivered = normalized.filter((order) => order.normalizedStatus === 'DELIVERED');
    const active = normalized.filter((order) => ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(order.normalizedStatus));
    const acceptedCount = normalized.filter((order) => order.normalizedStatus !== 'PENDING' && order.normalizedStatus !== 'CANCELLED').length;
    const decisions = acceptedCount + cancelled.length;
    const acceptanceRate = decisions > 0 ? Math.round((acceptedCount / decisions) * 100) : 0;

    const nonCancelledOrders = normalized.filter((order) => order.normalizedStatus !== 'CANCELLED');
    const grossRevenue = nonCancelledOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const deliveredRevenue = delivered.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const averageOrderValue = nonCancelledOrders.length > 0 ? grossRevenue / nonCancelledOrders.length : 0;

    const todayKey = new Date().toDateString();
    const todaysOrders = normalized.filter((order) => new Date(order.createdAt).toDateString() === todayKey).length;

    return {
      totalOrders: normalized.length,
      todaysOrders,
      pendingOrders: pending.length,
      activeOrders: active.length,
      cancelledOrders: cancelled.length,
      deliveredOrders: delivered.length,
      acceptanceRate,
      grossRevenue,
      deliveredRevenue,
      averageOrderValue
    };
  }, [orders]);

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <h1 className="text-h1">Incoming Orders</h1>
        {merchantStore && (
          <Button
            variant="outline"
            onClick={toggleStoreOpen}
            disabled={isTogglingStore}
            style={{
              color: merchantStore.isOpen === false ? '#ef4444' : '#16a34a',
              borderColor: merchantStore.isOpen === false ? '#fecaca' : '#bbf7d0'
            }}
          >
            {merchantStore.isOpen === false ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
            {isTogglingStore ? 'Updating...' : merchantStore.isOpen === false ? 'Store Closed (Tap to Open)' : 'Store Open (Tap to Close)'}
          </Button>
        )}
      </div>

      {storeStatusMessage && (
        <p className="text-sm" style={{ color: storeStatusMessage.includes('Failed') ? 'var(--error)' : 'var(--success, #16a34a)', marginBottom: '16px' }}>
          {storeStatusMessage}
        </p>
      )}

      {ringingOrderIds.length > 0 && (
        <Card style={{ padding: '16px', marginBottom: '20px', border: '1px solid #fca5a5', background: '#fef2f2' }} hoverable={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#b91c1c' }}>
            <BellRing size={20} />
            <div>
              <p style={{ fontWeight: 700 }}>New order alert: {ringingOrderIds.length} pending</p>
              <p className="text-sm">Alert keeps ringing until each new order is accepted or declined.</p>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ padding: '20px', marginBottom: '24px' }} hoverable={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <BarChart3 size={18} color="var(--primary)" />
          <h2 className="text-h3" style={{ margin: 0 }}>Performance Dashboard</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Total Orders</p>
            <p className="text-h3">{performance.totalOrders}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Today</p>
            <p className="text-h3">{performance.todaysOrders}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Pending</p>
            <p className="text-h3" style={{ color: '#dc2626' }}>{performance.pendingOrders}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Active</p>
            <p className="text-h3" style={{ color: '#2563eb' }}>{performance.activeOrders}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Acceptance Rate</p>
            <p className="text-h3">{performance.acceptanceRate}%</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Avg Order Value</p>
            <p className="text-h3">{formatKES(performance.averageOrderValue)}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Gross Revenue</p>
            <p className="text-h3" style={{ color: '#16a34a' }}>{formatKES(performance.grossRevenue)}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Delivered Revenue</p>
            <p className="text-h3" style={{ color: '#15803d' }}>{formatKES(performance.deliveredRevenue)}</p>
          </Card>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px', color: 'var(--text-muted)' }}>
          <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Delivered: {performance.deliveredOrders}</span>
          <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><StoreIcon size={14} /> Cancelled: {performance.cancelledOrders}</span>
          <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={14} /> New alerts: {ringingOrderIds.length}</span>
          <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} /> Live orders: {performance.activeOrders}</span>
        </div>
      </Card>

      {orders.length === 0 ? (
        <Card style={{ padding: '48px', textAlign: 'center' }} hoverable={false}>
          <p className="text-muted">No orders yet. Keep your app open to receive new requests!</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {orders.map(order => {
            const normalizedStatus = normalizeOrderStatus(order.status);

            return (
            <Card key={order.id} style={{ padding: '24px' }} hoverable={false}>
              <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div>
                  <h3 className="text-h3">Order #{order.id.split('-')[0]}</h3>
                  <p className="text-sm text-muted">{new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <div>
                  <span style={{ 
                    padding: '6px 12px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600,
                    background: normalizedStatus === 'PENDING'
                      ? 'var(--bg-color)'
                      : normalizedStatus === 'PREPARING'
                        ? 'rgba(234, 179, 8, 0.1)'
                        : normalizedStatus === 'CANCELLED'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(34, 197, 94, 0.1)',
                    color: normalizedStatus === 'PENDING'
                      ? 'var(--text-main)'
                      : normalizedStatus === 'PREPARING'
                        ? '#eab308'
                        : normalizedStatus === 'CANCELLED'
                          ? '#ef4444'
                          : '#22c55e'
                  }}>
                    {normalizedStatus}
                  </span>
                </div>
              </div>

              {ringingOrderIds.includes(order.id) && normalizedStatus === 'PENDING' && (
                <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: '#fff1f2', color: '#be123c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BellRing size={16} />
                  <span className="text-sm" style={{ fontWeight: 600 }}>New incoming order. Alert will stop after accept or decline.</span>
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <p className="text-sm font-semibold text-muted" style={{ marginBottom: '8px' }}>Customer Details</p>
                <p className="text-body">{order.customerInfo?.name}</p>
                <p className="text-body text-muted">{order.customerInfo?.address}</p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <p className="text-sm font-semibold text-muted" style={{ marginBottom: '8px' }}>Order Items</p>
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-semibold">{formatKES(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex-between" style={{ marginTop: '16px' }}>
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-h3">{formatKES(Number(order.total || 0))}</span>
                </div>
              </div>

              {normalizedStatus === 'PENDING' && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <Button onClick={() => updateOrderStatus(order.id, 'PREPARING')} style={{ flex: 1, background: '#eab308', color: 'black' }}>Accept & Start Preparing</Button>
                  <Button variant="outline" onClick={() => updateOrderStatus(order.id, 'CANCELLED')}>Decline</Button>
                </div>
              )}
              
              {normalizedStatus === 'PREPARING' && (
                <Button onClick={() => updateOrderStatus(order.id, 'READY_FOR_PICKUP')} style={{ width: '100%', background: '#22c55e' }}>Mark Ready for Driver Pickup</Button>
              )}
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}
