import { useState, useEffect, useRef } from 'react';
import { useLocation as useRouterLocation, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { CheckCircle, Clock, MapPin, Navigation, Package, Store } from 'lucide-react';
import { formatKES } from '../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../utils/authStorage';

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(true);
}

function statusToStep(status: string): number {
  switch (status?.toUpperCase()) {
    case 'PENDING':
    case 'CONFIRMED': return 1;
    case 'PREPARING': return 2;
    case 'ASSIGNED':
    case 'READY_FOR_PICKUP':
    case 'READYFORPICKUP': return 3;
    case 'DRIVER_ACCEPTED':
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
    case 'OUTFORDELIVERY':
    case 'ON_THE_WAY': return 4;
    case 'DELIVERED': return 5;
    default: return 1;
  }
}

export function OrderTracking() {
  const routerLocation = useRouterLocation();
  const params = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const stateOrderId = (routerLocation.state as any)?.orderId as string | undefined;
  const queryOrderId = searchParams.get('orderId') || undefined;
  const paymentIntentId = searchParams.get('payment_intent') || undefined;
  const paymentStatusHint = searchParams.get('payment_status') || undefined;
  const orderId = params.orderId || queryOrderId || stateOrderId;
  const handledPaymentNoticeRef = useRef<string | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [order, setOrder] = useState<any>(null);
  const [etaEstimate, setEtaEstimate] = useState<{ etaMinutes: number; minEta: number; maxEta: number; confidence: number } | null>(null);
  const [resolvedOrderId, setResolvedOrderId] = useState<string | undefined>(orderId);
  const [paymentIntentSummary, setPaymentIntentSummary] = useState<{
    id: string;
    status: string;
    provider?: string | null;
    action?: { type?: string; url?: string; message?: string } | null;
    orderId?: string | null;
  } | null>(null);
  const [isPaymentActionBusy, setIsPaymentActionBusy] = useState(false);
  const totalSteps = 5;

  const steps = [
    { id: 1, title: 'Order Placed',     description: 'Merchant received your order',        icon: CheckCircle },
    { id: 2, title: 'Preparing',        description: 'Merchant is preparing your order',    icon: Package },
    { id: 3, title: 'Driver Assigned',  description: 'The system assigned a courier',       icon: Navigation },
    { id: 4, title: 'On The Way',       description: 'Driver picked up and is heading over', icon: Navigation },
    { id: 5, title: 'Delivered',        description: 'OTP confirmed and order closed',      icon: MapPin },
  ];

  useEffect(() => {
    setResolvedOrderId(orderId);
  }, [orderId]);

  const loadPaymentIntent = async (intentId: string, options?: { reconcile?: boolean; silent?: boolean }) => {
    const endpoint = options?.reconcile
      ? `/api/payments/intents/${encodeURIComponent(intentId)}/reconcile`
      : `/api/payments/intents/${encodeURIComponent(intentId)}`;
    const res = await fetch(endpoint, {
      method: options?.reconcile ? 'POST' : 'GET',
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      if (!options?.silent) {
        throw new Error('Failed to load payment intent');
      }
      return null;
    }

    const payload = await res.json();
    const intent = payload.intent || payload;
    if (!intent) {
      return null;
    }

    setPaymentIntentSummary({
      id: intent.id,
      status: intent.status,
      provider: intent.provider || null,
      action: payload.action || null,
      orderId: intent.orderId || null
    });

    if (intent.orderId) {
      setResolvedOrderId(intent.orderId);
    }

    return intent;
  };

  useEffect(() => {
    if (!paymentIntentId) {
      return;
    }

    let active = true;

    const fetchPaymentIntent = async () => {
      try {
        const intent = await loadPaymentIntent(paymentIntentId, { reconcile: Boolean(paymentStatusHint), silent: true });
        if (!active || !intent) {
          return;
        }

        const noticeKey = `${paymentIntentId}:${paymentStatusHint || intent.status}`;
        if (handledPaymentNoticeRef.current === noticeKey) {
          return;
        }

        handledPaymentNoticeRef.current = noticeKey;
        if (paymentStatusHint === 'success' || intent.status === 'SUCCEEDED') {
          showToast('Payment confirmed. Your order is now being processed.', 'success');
        } else if (paymentStatusHint === 'cancelled' || intent.status === 'CANCELLED') {
          showToast('Payment was not completed. You can retry from the tracking page if needed.', 'info');
        } else if (intent.status === 'PROCESSING' || intent.status === 'REQUIRES_ACTION') {
          showToast('Payment is still pending confirmation.', 'info');
        }
      } catch {
        // Ignore transient payment lookup failures.
      }
    };

    fetchPaymentIntent();
    return () => {
      active = false;
    };
  }, [paymentIntentId, paymentStatusHint, showToast]);

  useEffect(() => {
    if (!order?.paymentIntentRef || paymentIntentId) {
      return;
    }

    loadPaymentIntent(order.paymentIntentRef, { silent: true }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.paymentIntentRef, paymentIntentId]);

  useEffect(() => {
    if (!resolvedOrderId) {
      if (paymentIntentId) {
        return;
      }

      // Issue 13: demo simulation when no real orderId
      if (currentStep < totalSteps) {
        const timer = setTimeout(() => setCurrentStep(prev => prev + 1), 5000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Issue 13: poll the API for real order status every 10 s
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(resolvedOrderId)}`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
          setCurrentStep(statusToStep(data.status));

          const etaRes = await fetch('/api/ai/eta', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ orderId: data.id })
          });

          if (etaRes.ok) {
            const etaData = await etaRes.json();
            setEtaEstimate({
              etaMinutes: Number(etaData.etaMinutes || 0),
              minEta: Number(etaData.minEta || 0),
              maxEta: Number(etaData.maxEta || 0),
              confidence: Number(etaData.confidence || 0)
            });
          }
        }
      } catch {
        // silently ignore network errors during polling
      }
    };

    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentIntentId, resolvedOrderId]);

  // Issue 12: correct ETA â€” show 0 / "Delivered!" when at step 4
  const etaMinutes = etaEstimate ? etaEstimate.etaMinutes : Math.max(0, 15 - currentStep * 3);

  const handleRefreshPayment = async () => {
    if (!paymentIntentSummary?.id || isPaymentActionBusy) {
      return;
    }

    setIsPaymentActionBusy(true);
    try {
      const intent = await loadPaymentIntent(paymentIntentSummary.id, { reconcile: true });
      if (intent?.status === 'SUCCEEDED') {
        showToast('Payment confirmed.', 'success');
      } else {
        showToast('Payment status refreshed.', 'info');
      }
    } catch {
      showToast('Could not refresh payment status.', 'error');
    } finally {
      setIsPaymentActionBusy(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!paymentIntentSummary?.id || isPaymentActionBusy) {
      return;
    }

    setIsPaymentActionBusy(true);
    try {
      const res = await fetch(`/api/payments/intents/${encodeURIComponent(paymentIntentSummary.id)}/retry`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const payload = await res.json().catch(() => ({ error: 'Failed to retry payment' }));
      if (!res.ok) {
        showToast(payload.error || 'Failed to retry payment', 'error');
        return;
      }

      const intent = payload.intent;
      setPaymentIntentSummary({
        id: intent.id,
        status: intent.status,
        provider: intent.provider || null,
        action: payload.action || null,
        orderId: intent.orderId || null
      });

      if (intent.orderId) {
        setResolvedOrderId(intent.orderId);
      }

      if (payload.action?.type === 'REDIRECT' && payload.action.url) {
        showToast(payload.action.message || 'Redirecting to complete payment.', 'info');
        window.location.assign(payload.action.url);
        return;
      }

      showToast(payload.action?.message || 'Payment retry started.', 'success');
    } catch {
      showToast('Could not retry payment.', 'error');
    } finally {
      setIsPaymentActionBusy(false);
    }
  };

  const canRetryPayment = Boolean(paymentIntentSummary && ['FAILED', 'CANCELLED'].includes(paymentIntentSummary.status));
  const canRefreshPayment = Boolean(paymentIntentSummary && ['REQUIRES_ACTION', 'PROCESSING', 'FAILED', 'CANCELLED'].includes(paymentIntentSummary.status));
  const canResumePayment = Boolean(paymentIntentSummary?.action?.type === 'REDIRECT' && paymentIntentSummary.action.url && paymentIntentSummary.status === 'REQUIRES_ACTION');

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px', padding: '0 24px' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <h1 className="text-h1">Track Order</h1>
        <div style={{ background: 'var(--surface)', padding: '8px 16px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
          <Clock size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>
            {currentStep === 5 ? (order?.paymentSettled ? 'Delivered & settled' : 'Delivered!') : `Arriving in ${etaMinutes} mins`}
          </span>
        </div>
      </div>

      {etaEstimate && currentStep !== 5 ? (
        <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>
          AI ETA range: {etaEstimate.minEta}-{etaEstimate.maxEta} mins ({etaEstimate.confidence}% confidence)
        </p>
      ) : null}

      {paymentIntentSummary && (
        <Card style={{ padding: '16px', marginBottom: '24px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.18)' }}>
          <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>Payment Status</p>
          <p style={{ fontWeight: 700, marginBottom: '4px' }}>{paymentIntentSummary.status.replace(/_/g, ' ')}</p>
          <p className="text-sm text-muted" style={{ marginBottom: 0 }}>
            {paymentIntentSummary.provider ? `${paymentIntentSummary.provider} payment` : 'Payment'} linked to this order will keep updating automatically.
          </p>
          {(canResumePayment || canRefreshPayment || canRetryPayment) && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              {canResumePayment && (
                <Button size="sm" onClick={() => window.location.assign(paymentIntentSummary.action?.url || '')} disabled={isPaymentActionBusy}>
                  Complete Payment
                </Button>
              )}
              {canRefreshPayment && (
                <Button variant="outline" size="sm" onClick={handleRefreshPayment} disabled={isPaymentActionBusy}>
                  Refresh Status
                </Button>
              )}
              {canRetryPayment && (
                <Button variant="outline" size="sm" onClick={handleRetryPayment} disabled={isPaymentActionBusy}>
                  Retry Payment
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Issue 11: order summary card when real order data is available */}
      {order && (
        <Card style={{ padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Store size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p className="text-sm text-muted" style={{ marginBottom: '2px' }}>Order #{String(order.id).slice(-6).toUpperCase()}</p>
            <p style={{ fontWeight: 600 }}>{order.store?.name || 'Your order'}</p>
            {order.items?.length > 0 && (
              <p className="text-sm text-muted">{order.items.map((i: any) => i.name || i.product?.name).filter(Boolean).join(', ')}</p>
            )}
          </div>
          <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{formatKES(Number(order.total))}</span>
        </Card>
      )}

      {order && statusToStep(order.status) === 4 && order.deliveryOtp && !order.deliveryOtpVerified && (
        <Card style={{ padding: '20px', marginBottom: '24px', background: 'rgba(59, 130, 246, 0.08)', border: '1px dashed #3b82f6' }}>
          <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>Delivery Handshake Code</p>
          <p style={{ fontSize: '2rem', letterSpacing: '0.25rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px' }}>
            {order.deliveryOtp}
          </p>
          <p className="text-sm text-muted">Share this 4-digit code with your courier at drop-off to complete delivery.</p>
        </Card>
      )}

      {order && statusToStep(order.status) === 4 && order.deliveryOtpVerified && (
        <Card style={{ padding: '16px', marginBottom: '24px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.35)' }}>
          <p style={{ fontWeight: 700, color: '#15803d' }}>Code verified with courier. Delivery completion is now unlocked.</p>
        </Card>
      )}

      {order?.paymentSettled && currentStep === 5 && (
        <Card style={{ padding: '16px', marginBottom: '24px', background: 'rgba(22, 163, 74, 0.08)', border: '1px solid rgba(22, 163, 74, 0.25)' }}>
          <p style={{ fontWeight: 700, color: '#166534' }}>Order closed and payment settlement recorded successfully.</p>
        </Card>
      )}

      {order && (order.pickedUpAt || order.deliveredAt) && (
        <Card style={{ padding: '16px', marginBottom: '24px' }}>
          {order.pickedUpAt && (
            <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>
              Picked up at: <strong style={{ color: 'var(--text-main)' }}>{new Date(order.pickedUpAt).toLocaleString()}</strong>
            </p>
          )}
          {order.deliveredAt && (
            <p className="text-sm text-muted">
              Delivered at: <strong style={{ color: 'var(--text-main)' }}>{new Date(order.deliveredAt).toLocaleString()}</strong>
            </p>
          )}
        </Card>
      )}

      <Card style={{ padding: '32px', marginBottom: '32px' }}>
        {/* Tracking map placeholder */}
        <div style={{ width: '100%', height: '240px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 50% 50%, var(--primary) 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
          <div className="flex-center" style={{ flexDirection: 'column', color: 'var(--primary)', zIndex: 2 }}>
            <Navigation size={48} style={{ transform: 'rotate(45deg)' }} />
            <span className="text-sm" style={{ marginTop: '16px', background: 'var(--surface)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-sm)', fontWeight: 600 }}>
              {currentStep === 5 ? 'Delivered!' : currentStep >= 4 ? 'Driver is on the way' : currentStep === 3 ? 'Driver assigned' : 'Order in progress'}
            </span>
          </div>
        </div>

        {/* Progress timeline */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive    = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const statusColor = isCompleted ? '#22c55e' : isActive ? 'var(--primary)' : 'var(--border)';
            const textColor   = isCompleted || isActive ? 'var(--text-main)' : 'var(--text-muted)';

            return (
              <div key={step.id} style={{ display: 'flex', gap: '24px', position: 'relative' }}>
                {index < steps.length - 1 && (
                  <div style={{
                    position: 'absolute', left: '23px', top: '48px', bottom: '-32px',
                    width: '2px', background: currentStep > step.id ? '#22c55e' : 'var(--border)',
                    zIndex: 1, transition: 'background 0.5s ease-in-out'
                  }} />
                )}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: isCompleted || isActive ? 'var(--surface)' : 'transparent',
                  border: `2px solid ${statusColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: statusColor, zIndex: 2,
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.3s ease-in-out', flexShrink: 0
                }}>
                  <Icon size={24} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 className="text-h3" style={{ color: textColor, marginBottom: '4px', transition: 'color 0.3s' }}>{step.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Issue 14: wired-up action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Button variant="outline" size="lg" onClick={() => showToast('Support is available 24/7 at help@fikisha.com', 'info')}>
          Contact Support
        </Button>
        <Button size="lg" disabled={currentStep < 3} onClick={() => showToast('Tip sent! Thank you for your generosity.', 'success')}>
          Tip Driver
        </Button>
      </div>
    </div>
  );
}
