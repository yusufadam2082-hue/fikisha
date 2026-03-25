import { useState, useEffect } from 'react';
import { useLocation as useRouterLocation, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { CheckCircle, Clock, MapPin, Navigation, Package, Store } from 'lucide-react';
import { formatKES } from '../utils/currency';

function getAuthHeaders(): HeadersInit {
  const user = JSON.parse(localStorage.getItem('fikisha_auth') || '{}');
  return {
    'Content-Type': 'application/json',
    ...(user.token ? { Authorization: `Bearer ${user.token}` } : {})
  };
}

function statusToStep(status: string): number {
  switch (status?.toUpperCase()) {
    case 'PENDING':
    case 'CONFIRMED': return 1;
    case 'PREPARING': return 2;
    case 'READY_FOR_PICKUP':
    case 'READYFORPICKUP':
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
    case 'OUTFORDELIVERY':
    case 'ON_THE_WAY': return 3;
    case 'DELIVERED': return 4;
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
  const orderId = params.orderId || queryOrderId || stateOrderId;

  const [currentStep, setCurrentStep] = useState(1);
  const [order, setOrder] = useState<any>(null);
  const [etaEstimate, setEtaEstimate] = useState<{ etaMinutes: number; minEta: number; maxEta: number; confidence: number } | null>(null);
  const totalSteps = 4;

  const steps = [
    { id: 1, title: 'Order Confirmed',  description: 'Store has received your order',      icon: CheckCircle },
    { id: 2, title: 'Preparing',        description: 'Your items are being prepared',       icon: Package },
    { id: 3, title: 'On the way',       description: 'Driver is heading to your location',  icon: Navigation },
    { id: 4, title: 'Delivered',        description: 'Order arrived successfully',           icon: MapPin },
  ];

  useEffect(() => {
    if (!orderId) {
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
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { headers: getAuthHeaders() });
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
  }, [orderId]);

  // Issue 12: correct ETA â€” show 0 / "Delivered!" when at step 4
  const etaMinutes = etaEstimate ? etaEstimate.etaMinutes : Math.max(0, 15 - currentStep * 3);

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px', padding: '0 24px' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <h1 className="text-h1">Track Order</h1>
        <div style={{ background: 'var(--surface)', padding: '8px 16px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
          <Clock size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>
            {currentStep === 4 ? 'Delivered!' : `Arriving in ${etaMinutes} mins`}
          </span>
        </div>
      </div>

      {etaEstimate && currentStep !== 4 ? (
        <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>
          AI ETA range: {etaEstimate.minEta}-{etaEstimate.maxEta} mins ({etaEstimate.confidence}% confidence)
        </p>
      ) : null}

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

      {order && statusToStep(order.status) === 3 && order.deliveryOtp && !order.deliveryOtpVerified && (
        <Card style={{ padding: '20px', marginBottom: '24px', background: 'rgba(59, 130, 246, 0.08)', border: '1px dashed #3b82f6' }}>
          <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>Delivery Handshake Code</p>
          <p style={{ fontSize: '2rem', letterSpacing: '0.25rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px' }}>
            {order.deliveryOtp}
          </p>
          <p className="text-sm text-muted">Share this 4-digit code with your courier at drop-off to complete delivery.</p>
        </Card>
      )}

      {order && statusToStep(order.status) === 3 && order.deliveryOtpVerified && (
        <Card style={{ padding: '16px', marginBottom: '24px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.35)' }}>
          <p style={{ fontWeight: 700, color: '#15803d' }}>Code verified with courier. Delivery completion is now unlocked.</p>
        </Card>
      )}

      <Card style={{ padding: '32px', marginBottom: '32px' }}>
        {/* Tracking map placeholder */}
        <div style={{ width: '100%', height: '240px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 50% 50%, var(--primary) 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
          <div className="flex-center" style={{ flexDirection: 'column', color: 'var(--primary)', zIndex: 2 }}>
            <Navigation size={48} style={{ transform: 'rotate(45deg)' }} />
            <span className="text-sm" style={{ marginTop: '16px', background: 'var(--surface)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-sm)', fontWeight: 600 }}>
              {currentStep === 4 ? 'Delivered!' : 'Driver is on the way'}
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
