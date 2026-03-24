import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MapPin, CheckCircle, Navigation, DollarSign, Briefcase } from 'lucide-react';
import { useStoreContext } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { formatKES } from '../utils/currency';

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

export function DriverDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available');
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpVerifying, setOtpVerifying] = useState<Record<string, boolean>>({});
  const [otpVerified, setOtpVerified] = useState<Record<string, boolean>>({});
  const { stores } = useStoreContext();
  const { showToast } = useToast();

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: getAuthHeaders()
      });
      if (res.ok && res.status !== 204) {
        const data = await res.json();
        setOrders(data);
        setOtpVerified((prev) => {
          const next = { ...prev };
          data.forEach((order: any) => {
            if (normalizeOrderStatus(order.status) === 'OUT_FOR_DELIVERY') {
              next[order.id] = Boolean(order.deliveryOtpVerified);
            }
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        if (newStatus === 'OUT_FOR_DELIVERY') {
          setOtpVerified((prev) => ({ ...prev, [id]: false }));
          setOtpInputs((prev) => ({ ...prev, [id]: '' }));
          showToast('Delivery accepted. Ask customer for OTP before completing.', 'info');
        }
        if (newStatus === 'DELIVERED') {
          showToast('Delivery completed successfully.', 'success');
        }
        fetchOrders(); // refresh
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to update order status.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Could not reach the server.', 'error');
    }

    if (newStatus === 'OUT_FOR_DELIVERY') {
      setActiveTab('active');
    }
  };

  const verifyOtp = async (id: string) => {
    const otp = (otpInputs[id] || '').trim();
    if (!/^\d{4}$/.test(otp)) {
      showToast('Enter the 4-digit code from the customer.', 'error');
      return;
    }

    setOtpVerifying((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/orders/${id}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ otp })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'OTP verification failed.', 'error');
        return;
      }

      setOtpVerified((prev) => ({ ...prev, [id]: true }));
      showToast('OTP verified. You can now complete this delivery.', 'success');
    } catch {
      showToast('Could not verify OTP right now.', 'error');
    } finally {
      setOtpVerifying((prev) => ({ ...prev, [id]: false }));
    }
  };

  const availableOrders = orders.filter(o => normalizeOrderStatus(o.status) === 'READY_FOR_PICKUP');
  // Backend already scopes driver-visible orders. Avoid extra local driverId filtering,
  // which can hide accepted orders when the auth payload lacks driverId.
  const activeOrders = orders.filter(o => normalizeOrderStatus(o.status) === 'OUT_FOR_DELIVERY');
  const completedOrders = orders.filter(o => normalizeOrderStatus(o.status) === 'DELIVERED');

  const revenueSummary = useMemo(() => {
    const totalRevenue = completedOrders.reduce((sum, order) => sum + (Number(order.deliveryFee) || 0), 0);
    const todaysCompleted = completedOrders.filter((order) => {
      const orderDate = new Date(order.updatedAt || order.createdAt);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    });

    const todaysRevenue = todaysCompleted.reduce((sum, order) => sum + (Number(order.deliveryFee) || 0), 0);

    return {
      totalRevenue,
      todaysRevenue,
      totalCompleted: completedOrders.length,
      todaysCompleted: todaysCompleted.length,
      averagePayout: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0
    };
  }, [completedOrders]);

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '0 24px' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-h1" style={{ marginBottom: '8px' }}>Driver Dashboard</h1>
          <p className="text-muted">You are currently online and accepting orders.</p>
        </div>
        <div style={{ padding: '8px 16px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
          Online
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('available')}
          style={{ 
            padding: '12px 24px', 
            borderBottom: activeTab === 'available' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'available' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600 
          }}
        >
          Available Pickups ({availableOrders.length})
        </button>
        <button 
          onClick={() => setActiveTab('active')}
          style={{ 
            padding: '12px 24px', 
            borderBottom: activeTab === 'active' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'active' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600 
          }}
        >
          Active Deliveries ({activeOrders.length})
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          style={{ 
            padding: '12px 24px', 
            borderBottom: activeTab === 'completed' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'completed' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600 
          }}
        >
          Completed Tasks ({completedOrders.length})
        </button>
      </div>

      {activeTab === 'completed' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <Card style={{ padding: '20px' }} hoverable={false}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="text-sm text-muted">Total Revenue</span>
              <DollarSign size={18} color="#16a34a" />
            </div>
            <p className="text-h2" style={{ color: '#16a34a' }}>{formatKES(revenueSummary.totalRevenue)}</p>
            <p className="text-sm text-muted">Based on platform payout per completed order</p>
          </Card>
          <Card style={{ padding: '20px' }} hoverable={false}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="text-sm text-muted">Completed Jobs</span>
              <Briefcase size={18} color="var(--primary)" />
            </div>
            <p className="text-h2">{revenueSummary.totalCompleted}</p>
            <p className="text-sm text-muted">All-time finished deliveries</p>
          </Card>
          <Card style={{ padding: '20px' }} hoverable={false}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="text-sm text-muted">Today</span>
              <CheckCircle size={18} color="#2563eb" />
            </div>
            <p className="text-h2">{revenueSummary.todaysCompleted}</p>
            <p className="text-sm text-muted">Revenue: {formatKES(revenueSummary.todaysRevenue)}</p>
          </Card>
          <Card style={{ padding: '20px' }} hoverable={false}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="text-sm text-muted">Avg Payout</span>
              <DollarSign size={18} color="#7c3aed" />
            </div>
            <p className="text-h2">{formatKES(revenueSummary.averagePayout)}</p>
            <p className="text-sm text-muted">Average earning per completed order</p>
          </Card>
        </div>
      )}

      {/* Order List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
        {activeTab === 'available' && availableOrders.length === 0 && (
          <div className="flex-center" style={{ flexDirection: 'column', padding: '64px 0', color: 'var(--text-muted)' }}>
            <Navigation size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p className="text-h3">No available orders</p>
            <p>Merchants are still preparing food. Waiting for orders to be ready...</p>
          </div>
        )}

        {(activeTab === 'available' ? availableOrders : activeTab === 'active' ? activeOrders : completedOrders).map(order => {
          const store = stores.find(s => s.id === order.storeId);
          const storeName = order.store?.name || store?.name || 'Unknown Store';
          const storeAddress = order.store?.address || store?.address || 'Store address not provided';
          const dropoffName = order.customerInfo?.name || order.customer?.name || 'Customer';
          const dropoffAddress = order.customerInfo?.address
            || order.deliveryAddress?.address
            || (typeof order.deliveryAddress === 'string' ? order.deliveryAddress : null)
            || 'Customer address not provided';
          const itemsCount = order.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0;
          const isOtpVerified = Boolean(otpVerified[order.id] || order.deliveryOtpVerified);

          return (
            <Card key={order.id} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }} hoverable={false}>
              <div className="flex-between">
                <div>
                  <h3 className="text-h2" style={{ marginBottom: '4px' }}>{formatKES(Number(order.total || 0))}</h3>
                  <span className="text-sm text-muted">Order {order.orderNumber || `FK-${String(order.id).replace(/-/g, '').slice(-6).toUpperCase()}`} • {itemsCount} items</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--primary)', display: 'block' }}>
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                  {activeTab === 'completed' && (
                    <span className="text-sm" style={{ color: '#16a34a', fontWeight: 700 }}>
                      Earned {formatKES(Number(order.deliveryFee || 0))}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <MapPin size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p className="text-sm font-semibold text-muted">PICKUP</p>
                    <p className="text-body" style={{ fontWeight: 600 }}>{storeName}</p>
                    <p className="text-sm text-muted">{storeAddress}</p>
                  </div>
                </div>
                
                <div style={{ width: '2px', height: '20px', background: 'var(--border)', margin: '0 0 0 9px' }} />
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Navigation size={20} color="var(--text-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p className="text-sm font-semibold text-muted">DROPOFF</p>
                    <p className="text-body" style={{ fontWeight: 600 }}>{dropoffName}</p>
                    <p className="text-sm text-muted">{dropoffAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex-between" style={{ gap: '16px', marginTop: '8px' }}>
                {normalizeOrderStatus(order.status) === 'READY_FOR_PICKUP' && (
                  <>
                    <Button variant="outline" fullWidth>Ignore</Button>
                    <Button fullWidth onClick={() => updateOrderStatus(order.id, 'OUT_FOR_DELIVERY')} style={{ background: '#22c55e' }}>Accept Delivery</Button>
                  </>
                )}
                {normalizeOrderStatus(order.status) === 'OUT_FOR_DELIVERY' && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                      <input
                        className="input-field"
                        placeholder="Enter customer OTP"
                        inputMode="numeric"
                        maxLength={4}
                        value={otpInputs[order.id] || ''}
                        onChange={(e) => setOtpInputs((prev) => ({ ...prev, [order.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      />
                      <Button
                        variant="outline"
                        onClick={() => verifyOtp(order.id)}
                        disabled={otpVerifying[order.id] || isOtpVerified}
                      >
                        {isOtpVerified ? 'Verified' : otpVerifying[order.id] ? 'Verifying...' : 'Verify OTP'}
                      </Button>
                    </div>
                    <Button
                      fullWidth
                      onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                      disabled={!isOtpVerified}
                      style={{
                        background: isOtpVerified ? '#3b82f6' : 'var(--surface-hover)',
                        color: isOtpVerified ? 'white' : 'var(--text-muted)',
                        cursor: isOtpVerified ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <CheckCircle size={18} /> {isOtpVerified ? 'Complete Delivery' : 'Complete Delivery (Locked: verify OTP first)'}
                    </Button>
                  </div>
                )}
                {normalizeOrderStatus(order.status) === 'DELIVERED' && (
                  <div style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.08)', color: '#16a34a', fontWeight: 700, textAlign: 'center' }}>
                    Completed • Platform payout: {formatKES(Number(order.deliveryFee || 0))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {activeTab === 'active' && activeOrders.length === 0 && (
          <div className="flex-center" style={{ flexDirection: 'column', padding: '64px 0', color: 'var(--text-muted)' }}>
            <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p className="text-h3">No active deliveries</p>
            <p>Accept an order to start earning.</p>
          </div>
        )}

        {activeTab === 'completed' && completedOrders.length === 0 && (
          <div className="flex-center" style={{ flexDirection: 'column', padding: '64px 0', color: 'var(--text-muted)' }}>
            <Briefcase size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p className="text-h3">No completed tasks yet</p>
            <p>Completed deliveries will appear here together with your earnings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
