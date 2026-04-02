import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BellRing, BarChart3, Clock, DollarSign, ShoppingBag, Store as StoreIcon, ToggleLeft, ToggleRight, Printer, FileDown } from 'lucide-react';
import { formatKES } from '../../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';
import { getMerchantOrderFinancials } from '../../utils/merchantFinance';
import { apiUrl } from '../../utils/apiUrl';

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(false);
}

function normalizeOrderStatus(status: string): string {
  const key = String(status || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');

  if (key === 'READYFORPICKUP') return 'READY_FOR_PICKUP';
  if (key === 'OUTFORDELIVERY' || key === 'INTRANSIT' || key === 'ONTHEWAY') return 'OUT_FOR_DELIVERY';
  return key;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReceiptHtml(order: any): string {
  const financials = getMerchantOrderFinancials(order);
  const storeName = order?.store?.name || 'Store';
  const storePhone = order?.store?.phone || 'N/A';
  const storeAddress = order?.store?.address || 'N/A';
  const orderNumber = order?.orderNumber || order?.id || 'N/A';
  const createdAt = order?.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString();
  const customerName = order?.customerInfo?.name || order?.customer?.name || 'N/A';
  const customerPhone = order?.customerInfo?.phone || order?.customer?.phone || 'N/A';
  const deliveryAddress = order?.deliveryAddress?.address || order?.deliveryAddress?.fullAddress || order?.customerInfo?.address || 'N/A';
  const orderType = financials.deliveryFee > 0 ? 'Delivery' : 'Pickup';
  const paymentMethod = order?.paymentProvider || 'N/A';
  const paymentStatus = order?.paymentStatus || 'N/A';
  const driverName = order?.assignedDriverName || order?.driver?.name || 'Unassigned';
  const orderNotes = order?.customerInfo?.notes || order?.notes || 'None';
  const showMerchantNetIncome = true;

  const itemRows = Array.isArray(order?.items) && order.items.length > 0
    ? order.items.map((item: any) => {
        const qty = Number(item?.quantity || 0);
        const unitPrice = Number(item?.price || 0);
        const total = qty * unitPrice;
        const itemName = item?.name || item?.product?.name || 'Item';
        const itemNotes = item?.note || item?.notes || item?.specialInstructions || '';
        return `
<div class="row"><span>${escapeHtml(itemName)}</span></div>
<div class="row"><span>${qty} x ${formatKES(unitPrice)}</span><span>${formatKES(total)}</span></div>
${itemNotes ? `<div class="muted">Note: ${escapeHtml(itemNotes)}</div>` : ''}`;
      }).join('\n')
    : '<div class="row"><span>No line items available</span></div>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(orderNumber)}</title>
<style>
  @page { margin: 6mm; }
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
  }
  .receipt {
    width: 100%;
    max-width: 80mm;
    margin: 0 auto;
    padding: 4mm 2mm;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; gap: 10px; margin: 2px 0; }
  .muted { font-size: 11px; margin: 1px 0 4px; }
  .attach {
    border: 1px solid #000;
    padding: 6px;
    margin: 10px 0;
    text-align: center;
    font-weight: 700;
  }
  @media print {
    body { width: 100%; }
    .receipt { max-width: 80mm; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center bold">${escapeHtml(storeName)}</div>
    <div class="center">Tel: ${escapeHtml(storePhone)}</div>
    <div class="center">${escapeHtml(storeAddress)}</div>
    <div class="line"></div>

    <div class="row"><span>Order #</span><span>${escapeHtml(orderNumber)}</span></div>
    <div class="row"><span>Date/Time</span><span>${escapeHtml(createdAt)}</span></div>
    <div class="row"><span>Order Type</span><span>${escapeHtml(orderType)}</span></div>
    <div class="line"></div>

    <div class="row"><span>Customer</span><span>${escapeHtml(customerName)}</span></div>
    <div class="row"><span>Phone</span><span>${escapeHtml(customerPhone)}</span></div>
    <div class="muted">Address: ${escapeHtml(deliveryAddress)}</div>
    <div class="line"></div>

    <div class="bold">ITEMS</div>
    ${itemRows}
    <div class="line"></div>

    <div class="row"><span>Items Subtotal</span><span>${formatKES(financials.itemsSubtotal)}</span></div>
    <div class="row"><span>Delivery Fee</span><span>${formatKES(financials.deliveryFee)}</span></div>
    <div class="muted">(Not included in merchant earnings)</div>
    <div class="row"><span>Platform Fee</span><span>${formatKES(financials.platformFee)}</span></div>
    <div class="row"><span>Discounts</span><span>${formatKES(financials.discountAmount)}</span></div>
    <div class="row bold"><span>Total Paid</span><span>${formatKES(financials.customerTotal)}</span></div>
    ${showMerchantNetIncome ? `<div class="row bold"><span>Merchant Net Income</span><span>${formatKES(financials.merchantNetIncome)}</span></div>` : ''}
    <div class="line"></div>

    <div class="row"><span>Payment</span><span>${escapeHtml(paymentMethod)}</span></div>
    <div class="row"><span>Status</span><span>${escapeHtml(paymentStatus)}</span></div>
    <div class="row"><span>Driver</span><span>${escapeHtml(driverName)}</span></div>
    <div class="muted">Order Notes: ${escapeHtml(orderNotes)}</div>

    <div class="attach">ATTACH THIS RECEIPT TO ORDER</div>
    <div class="center">Thank you for serving with Mtaaexpress</div>
    <div class="center">Support: help@mtaaexpress.com</div>
  </div>
</body>
</html>`;
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
      const res = await fetch(apiUrl('/api/orders'), {
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
      const res = await fetch(apiUrl(`/api/orders/${orderId}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openReceiptWindow = (order: any, autoPrint: boolean) => {
    const receiptWindow = window.open('', '_blank', 'width=420,height=900');
    if (!receiptWindow) return;

    receiptWindow.document.open();
    receiptWindow.document.write(buildReceiptHtml(order));
    receiptWindow.document.close();

    if (autoPrint) {
      setTimeout(() => {
        receiptWindow.focus();
        receiptWindow.print();
      }, 250);
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
      normalizedStatus: normalizeOrderStatus(order.status),
      financials: getMerchantOrderFinancials(order)
    }));

    const pending = normalized.filter((order) => order.normalizedStatus === 'PENDING');
    const cancelled = normalized.filter((order) => order.normalizedStatus === 'CANCELLED');
    const delivered = normalized.filter((order) => order.normalizedStatus === 'DELIVERED');
    const active = normalized.filter((order) => ['PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED', 'DRIVER_ACCEPTED', 'OUT_FOR_DELIVERY'].includes(order.normalizedStatus));
    const acceptedCount = normalized.filter((order) => order.normalizedStatus !== 'PENDING' && order.normalizedStatus !== 'CANCELLED').length;
    const decisions = acceptedCount + cancelled.length;
    const acceptanceRate = decisions > 0 ? Math.round((acceptedCount / decisions) * 100) : 0;

    const nonCancelledOrders = normalized.filter((order) => order.normalizedStatus !== 'CANCELLED');
    const totalNetIncome = nonCancelledOrders.reduce((sum, order) => sum + order.financials.merchantNetIncome, 0);
    const deliveredNetIncome = delivered.reduce((sum, order) => sum + order.financials.merchantNetIncome, 0);
    const averageNetIncomePerOrder = nonCancelledOrders.length > 0 ? totalNetIncome / nonCancelledOrders.length : 0;

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
      totalNetIncome,
      deliveredNetIncome,
      averageNetIncomePerOrder
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
            <p className="text-sm text-muted">Avg Net Income / Order</p>
            <p className="text-h3">{formatKES(performance.averageNetIncomePerOrder)}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Total Net Income</p>
            <p className="text-h3" style={{ color: '#16a34a' }}>{formatKES(performance.totalNetIncome)}</p>
          </Card>
          <Card style={{ padding: '14px' }} hoverable={false}>
            <p className="text-sm text-muted">Delivered Net Income</p>
            <p className="text-h3" style={{ color: '#15803d' }}>{formatKES(performance.deliveredNetIncome)}</p>
          </Card>
        </div>
        <p className="text-sm text-muted" style={{ marginTop: '12px' }}>Not included in your earnings: Delivery Fee</p>
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
            const financials = getMerchantOrderFinancials(order);

            return (
            <Card key={order.id} style={{ padding: '24px' }} hoverable={false}>
              <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div>
                  <h3 className="text-h3">Order #{(order.orderNumber || order.id).split('-')[0]}</h3>
                  <p className="text-sm text-muted">{new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Button variant="outline" onClick={() => openReceiptWindow(order, true)}><Printer size={16} /> Print Receipt</Button>
                  <Button variant="outline" onClick={() => openReceiptWindow(order, true)}><FileDown size={16} /> Download PDF</Button>
                  <span style={{ 
                    padding: '6px 12px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600,
                    background: normalizedStatus === 'PENDING'
                      ? 'var(--bg-color)'
                      : normalizedStatus === 'PREPARING'
                        ? 'rgba(234, 179, 8, 0.1)'
                        : normalizedStatus === 'ASSIGNED'
                          ? 'rgba(59, 130, 246, 0.12)'
                          : normalizedStatus === 'DRIVER_ACCEPTED'
                            ? 'rgba(99, 102, 241, 0.12)'
                          : normalizedStatus === 'CANCELLED'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(34, 197, 94, 0.1)',
                    color: normalizedStatus === 'PENDING'
                      ? 'var(--text-main)'
                      : normalizedStatus === 'PREPARING'
                        ? '#eab308'
                        : normalizedStatus === 'ASSIGNED'
                          ? '#2563eb'
                          : normalizedStatus === 'DRIVER_ACCEPTED'
                            ? '#4f46e5'
                          : normalizedStatus === 'CANCELLED'
                            ? '#ef4444'
                            : '#22c55e'
                  }}>
                    {normalizedStatus.replace(/_/g, ' ')}
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
                <p className="text-body">{order.customerInfo?.name || order.customer?.name}</p>
                <p className="text-body text-muted">{order.customerInfo?.address || order.deliveryAddress?.address}</p>
                {(order.customerInfo?.phone || order.customer?.phone) && (
                  <p className="text-sm text-muted">Phone: {order.customerInfo?.phone || order.customer?.phone}</p>
                )}
                {order.assignedDriverName && (
                  <p className="text-sm text-muted" style={{ marginTop: '8px' }}>
                    Assigned driver: <strong style={{ color: 'var(--text-main)' }}>{order.assignedDriverName}</strong>
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <p className="text-sm font-semibold text-muted" style={{ marginBottom: '8px' }}>Order Items</p>
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-semibold">{formatKES(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '20px', padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-hover)' }}>
                <p className="text-sm font-semibold text-muted" style={{ marginBottom: '8px' }}>Financial Breakdown</p>
                <div className="flex-between"><span>Items Total</span><span>{formatKES(financials.itemsSubtotal)}</span></div>
                <div className="flex-between"><span>Delivery Fee</span><span>{formatKES(financials.deliveryFee)}</span></div>
                <p className="text-sm text-muted" style={{ margin: '2px 0 8px' }}>Not included in your earnings: Delivery Fee</p>
                <div className="flex-between"><span>Platform Fee / Commission</span><span>{formatKES(financials.platformFee)}</span></div>
                <div className="flex-between"><span>Discounts</span><span>{formatKES(financials.discountAmount)}</span></div>
                <div className="flex-between"><span>Total Paid by Customer</span><span>{formatKES(financials.customerTotal)}</span></div>
                <div className="flex-between" style={{ marginTop: '8px', fontWeight: 700 }}><span>Merchant Net Income</span><span>{formatKES(financials.merchantNetIncome)}</span></div>
              </div>

              {normalizedStatus === 'PENDING' && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <Button onClick={() => updateOrderStatus(order.id, 'PREPARING')} style={{ flex: 1, background: '#eab308', color: 'black' }}>Accept & Start Preparing</Button>
                  <Button variant="outline" onClick={() => updateOrderStatus(order.id, 'CANCELLED')}>Decline</Button>
                </div>
              )}
              
              {normalizedStatus === 'PREPARING' && (
                <Button onClick={() => updateOrderStatus(order.id, 'ASSIGNED')} style={{ width: '100%', background: '#22c55e' }}>Order Prepared, Assign Driver</Button>
              )}

              {(normalizedStatus === 'ASSIGNED' || normalizedStatus === 'READY_FOR_PICKUP') && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.08)', color: '#1d4ed8' }}>
                  Driver assigned. Waiting for courier to accept the job.
                </div>
              )}

              {normalizedStatus === 'DRIVER_ACCEPTED' && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.08)', color: '#4338ca' }}>
                  Driver accepted the job and is heading for pickup.
                </div>
              )}

              {normalizedStatus === 'OUT_FOR_DELIVERY' && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.08)', color: '#15803d' }}>
                  Order picked up. Customer will confirm handoff using OTP on delivery.
                </div>
              )}

              {normalizedStatus === 'DELIVERED' && order.paymentSettled && (
                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(22, 163, 74, 0.08)', color: '#166534' }}>
                  Order closed and settlement recorded.
                </div>
              )}
            </Card>
          );})}
        </div>
      )}
    </div>
  );
}