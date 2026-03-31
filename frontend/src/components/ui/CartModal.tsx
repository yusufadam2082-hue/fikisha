import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';
import { X, Minus, Plus, ShoppingBag, MapPin, Clock, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatKES } from '../../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';

const FALLBACK_DELIVERY_FEE = 1.99;

interface StoredPaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
  phoneNumber?: string;
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(true);
}

export function CartModal() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, total, clearCart } = useCart();
  const {
    deliveryAddress,
    setDeliveryAddress,
    activeLocation,
    openLocationSelector,
    deliveryQuote,
    isFetchingQuote,
    fetchDeliveryQuote,
    clearDeliveryQuote,
  } = useLocation();
  const { user, logout } = useAuth();
  // Issue 25: replace alert() with toast notifications
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<StoredPaymentMethod[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('cod');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const deliveryFee = deliveryQuote?.deliveryFee ?? FALLBACK_DELIVERY_FEE;

  useEffect(() => {
    if (!isCartOpen) {
      setShowCheckoutConfirm(false);
      clearDeliveryQuote();
      return;
    }

    setConfirmedAddress(activeLocation?.address || deliveryAddress || '');
    const storedPaymentMethods = JSON.parse(localStorage.getItem('fikisha_payment_methods') || '[]') as StoredPaymentMethod[];
    const validStored = Array.isArray(storedPaymentMethods) ? storedPaymentMethods : [];
    setPaymentMethods(validStored);
    const defaultPayment = validStored.find((method) => method.isDefault) || validStored[0];
    setSelectedPaymentId(defaultPayment?.id || 'cod');
  }, [isCartOpen, deliveryAddress, activeLocation?.address, clearDeliveryQuote]);

  // Fetch delivery quote when cart opens with an active location and items
  useEffect(() => {
    if (!isCartOpen || !activeLocation || items.length === 0) return;
    const storeId = items[0].storeId;
    if (!storeId) return;
    fetchDeliveryQuote(storeId, total).catch(() => {});
  }, [isCartOpen, activeLocation, total, items, fetchDeliveryQuote]);

  const selectedPayment = selectedPaymentId === 'cod'
    ? null
    : paymentMethods.find((method) => method.id === selectedPaymentId) || null;

  const isMpesaMethod = (method: StoredPaymentMethod | null) => {
    const normalizedType = String(method?.type || '').toLowerCase();
    return normalizedType.includes('mpesa') || normalizedType.includes('m-pesa') || normalizedType.includes('mobile money');
  };

  const getPaymentLabel = () => {
    if (!selectedPayment) {
      return 'Cash on Delivery';
    }
    if (isMpesaMethod(selectedPayment)) {
      return `M-Pesa ${selectedPayment.phoneNumber || `•••• ${selectedPayment.last4}`}`;
    }
    return `${selectedPayment.type} •••• ${selectedPayment.last4}`;
  };

  const getSelectedPaymentProvider = () => {
    if (!selectedPayment) {
      return 'COD';
    }

    const normalizedType = selectedPayment.type.toLowerCase();
    if (normalizedType.includes('mpesa') || normalizedType.includes('m-pesa') || normalizedType.includes('mobile money')) {
      return 'MPESA';
    }

    return 'STRIPE';
  };

  const validateCustomerSession = async () => {
    const headers = getAuthHeaders();
    if (!('Authorization' in headers)) {
      showToast('Your session is missing. Please log in again.', 'error');
      logout();
      navigate('/customer/login');
      return false;
    }

    try {
      const res = await fetch('/api/me', { headers });
      if (!res.ok) {
        showToast('Your session expired. Please log in again.', 'error');
        logout();
        navigate('/customer/login');
        return false;
      }

      const currentUser = await res.json();
      if (currentUser.role !== 'CUSTOMER') {
        showToast('This checkout can only be completed from a customer account. Please log in again as customer.', 'error');
        logout();
        navigate('/customer/login');
        return false;
      }

      return true;
    } catch {
      showToast('Could not verify your session. Please try again.', 'error');
      return false;
    }
  };

  const submitOrder = async () => {
    if (items.length === 0 || isSubmittingOrder) return;

    if (!user) {
      showToast('Please log in before checkout.', 'error');
      navigate('/customer/login');
      return;
    }

    if (user.role !== 'CUSTOMER') {
      showToast(`Checkout is only available for customer accounts. You are logged in as ${user.role}.`, 'error');
      return;
    }

    if (!activeLocation) {
      showToast('Please set a delivery location before placing the order.', 'error');
      openLocationSelector();
      setIsCartOpen(false);
      return;
    }

    if (!confirmedAddress.trim()) {
      showToast('Please confirm your delivery address before placing the order.', 'error');
      return;
    }

    if (!selectedPaymentId) {
      showToast('Please select a payment method to continue.', 'error');
      return;
    }

    const hasValidSession = await validateCustomerSession();
    if (!hasValidSession) {
      return;
    }

    setDeliveryAddress(confirmedAddress.trim());

    const storeId = items[0].storeId;
    const checkoutTotal = total + deliveryFee;
    const paymentProvider = getSelectedPaymentProvider();
    let paymentIntentId: string | null = null;
    let paymentAction: { type?: string; url?: string; message?: string } | null = null;

    setIsSubmittingOrder(true);

    try {
      if (paymentProvider !== 'COD') {
        try {
          const paymentIntentResponse = await fetch('/api/payments/intents', {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'X-Idempotency-Key': `${user.id}:${storeId}:${selectedPaymentId}:${items.map((item) => `${item.id}:${item.quantity}`).join('|')}`
            },
            body: JSON.stringify({
              amount: checkoutTotal,
              currency: 'KES',
              provider: paymentProvider,
              phoneNumber: paymentProvider === 'MPESA' ? user.phone || undefined : undefined,
              description: `Fikisha order payment for ${items.length} item${items.length === 1 ? '' : 's'}`,
              returnUrlBase: window.location.origin,
              metadata: {
                storeId,
                cartItemCount: items.length,
                paymentMethodLabel: getPaymentLabel()
              }
            })
          });

          const paymentPayload = await paymentIntentResponse.json().catch(() => ({ error: 'Failed to create payment intent' }));
          if (!paymentIntentResponse.ok) {
            showToast(paymentPayload.error || 'Failed to start payment', 'error');
            return;
          }

          paymentIntentId = paymentPayload.intent?.id || null;
          paymentAction = paymentPayload.action || null;
        } catch (error) {
          console.error('Failed to create payment intent', error);
          showToast('Could not start the payment step. Please try again.', 'error');
          return;
        }
      }

      // Validate serviceability via delivery quote before submitting
      if (activeLocation) {
        const liveQuote = await fetchDeliveryQuote(storeId, total);
        if (liveQuote && !liveQuote.serviceable) {
          showToast(
            liveQuote.minOrderValue && !liveQuote.orderValueValid
              ? `Minimum order for this zone is ${formatKES(liveQuote.minOrderValue)}.`
              : 'This store does not deliver to your selected location.',
            'error'
          );
          setIsSubmittingOrder(false);
          return;
        }
      }

      const orderData = {
        storeId,
        items,
        total: checkoutTotal,
        paymentIntentId,
        deliveryAddress: activeLocation ? {
          address: confirmedAddress.trim(),
          latitude: activeLocation.latitude,
          longitude: activeLocation.longitude,
          source: activeLocation.source,
        } : undefined,
        customerInfo: {
          name: user.name || user.username || 'Customer',
          address: confirmedAddress.trim(),
          paymentMethod: getPaymentLabel(),
          paymentProvider: paymentProvider === 'COD' ? null : paymentProvider
        }
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(orderData)
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Order failed' }));
        if (res.status === 403) {
          showToast('Checkout was denied by the server. Your session may be stale. Please log in again as a customer.', 'error');
          logout();
          navigate('/customer/login');
        } else {
          showToast(error.error || 'Failed to submit order', 'error');
        }
        return;
      }

      const data = await res.json();
      setIsCartOpen(false);
      setShowCheckoutConfirm(false);
      clearCart();
      const orderId = data.id || data.order?.id;
      const trackingPath = orderId
        ? `/customer/tracking/${encodeURIComponent(String(orderId))}`
        : '/customer/tracking';

      if (paymentAction?.type === 'REDIRECT' && paymentAction.url) {
        showToast(paymentAction.message || 'Order placed. Redirecting to secure payment.', 'info');
        window.location.assign(paymentAction.url);
        return;
      }

      if (paymentAction?.type === 'STK_PUSH') {
        showToast(paymentAction.message || 'Order placed. Confirm the payment prompt on your phone.', 'info');
      } else if (paymentProvider === 'COD') {
        showToast('Order placed successfully.', 'success');
      }

      navigate(trackingPath, orderId ? { state: { orderId } } : undefined);
    } catch (err) {
      console.error('Failed to submit order', err);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) return;

    if (!user) {
      showToast('Please log in before checkout.', 'error');
      navigate('/customer/login');
      return;
    }

    if (user.role !== 'CUSTOMER') {
      showToast(`Checkout is only available for customer accounts. You are logged in as ${user.role}.`, 'error');
      return;
    }

    if (!activeLocation && !deliveryAddress) {
      openLocationSelector();
      setIsCartOpen(false);
      return;
    }

    setConfirmedAddress(activeLocation?.address || deliveryAddress);
    setShowCheckoutConfirm(true);
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}
        onClick={() => setIsCartOpen(false)}
        className="animate-fade-in"
      />
      {/* Issue 22: slide-in-right instead of fade */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: '400px',
          backgroundColor: 'var(--surface)', zIndex: 1001,
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}
        className="animate-slide-in-right"
      >
        <div className="flex-between" style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-h2 flex-center" style={{ gap: '12px' }}>
            <ShoppingBag size={24} color="#a63400" />
            Your Cart
          </h2>
          <button className="btn-icon" onClick={() => setIsCartOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {items.length === 0 ? (
            <div className="flex-center" style={{ flexDirection: 'column', height: '100%', color: 'var(--text-muted)' }}>
              <ShoppingBag size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p className="text-h3" style={{ marginBottom: '8px' }}>Your cart is empty</p>
              <p className="text-body text-center">Looks like you haven't added anything yet.</p>
              <Button onClick={() => setIsCartOpen(false)} style={{ marginTop: '24px' }}>Start browsing</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {items.map(item => (
                <div key={item.id} className="flex-between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <h4 className="text-h3" style={{ fontSize: '1rem', marginBottom: '2px' }}>{item.name}</h4>
                    {/* Issue 20: show per-item subtotal */}
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {formatKES(item.price)} x {item.quantity} ={' '}
                      <strong style={{ color: 'var(--text-main)' }}>{formatKES(item.price * item.quantity)}</strong>
                    </span>
                  </div>
                  <div className="flex-center" style={{ gap: '12px', background: 'var(--surface-hover)', padding: '6px', borderRadius: 'var(--radius-pill)' }}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Minus size={16} />
                    </button>
                    <span style={{ fontWeight: 600, width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            {/* Location chip */}
            {!activeLocation ? (
              <button
                type="button"
                onClick={() => { setIsCartOpen(false); openLocationSelector(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '10px 14px', marginBottom: '12px',
                  background: 'rgba(166, 52, 0, 0.06)', border: '1px dashed #a63400',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', color: '#a63400',
                  fontSize: '0.875rem', fontWeight: 500,
                }}
              >
                <Navigation size={15} />
                Set delivery location to see accurate fee &amp; ETA
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setIsCartOpen(false); openLocationSelector(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '8px 12px', marginBottom: '12px',
                  background: 'var(--surface-hover)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.8rem',
                }}
              >
                <MapPin size={14} color="#a63400" style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--text-main)' }}>
                  {activeLocation.label}
                </span>
                <span style={{ color: '#a63400', fontWeight: 600 }}>Change</span>
              </button>
            )}

            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="text-body text-muted">Subtotal</span>
              <span className="text-body">{formatKES(total)}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: deliveryQuote?.etaMinutes ? '4px' : '24px' }}>
              <span className="text-body text-muted">
                Delivery Fee {isFetchingQuote ? '...' : ''}
              </span>
              <span className="text-body">{formatKES(deliveryFee)}</span>
            </div>
            {deliveryQuote?.etaMinutes && (
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                <span className="text-body text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> ETA
                </span>
                <span className="text-body">{deliveryQuote.etaMinMinutes}–{deliveryQuote.etaMaxMinutes} min</span>
              </div>
            )}
            {!showCheckoutConfirm ? (
              <Button
                fullWidth
                size="lg"
                style={{ fontSize: '1.1rem' }}
                onClick={handleCheckout}
                disabled={isSubmittingOrder}
              >
                Checkout - {formatKES(total + deliveryFee)}
              </Button>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-center" style={{ gap: '8px', justifyContent: 'flex-start', marginBottom: '8px' }}>
                    <MapPin size={16} color="#a63400" />
                    <p className="text-sm" style={{ fontWeight: 700, margin: 0 }}>Confirm Delivery Address</p>
                  </div>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={confirmedAddress}
                    onChange={(e) => setConfirmedAddress(e.target.value)}
                    style={{ width: '100%', maxHeight: '120px', overflowY: 'auto', resize: 'none' }}
                  />
                </div>

                <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                  <p className="text-sm" style={{ fontWeight: 700, marginBottom: '8px' }}>Confirm Payment Method</p>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="checkout-payment"
                        checked={selectedPaymentId === 'cod'}
                        onChange={() => setSelectedPaymentId('cod')}
                      />
                      <span className="text-sm">Cash on Delivery</span>
                    </label>
                    {paymentMethods.map((method) => (
                      <label key={method.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="checkout-payment"
                          checked={selectedPaymentId === method.id}
                          onChange={() => setSelectedPaymentId(method.id)}
                        />
                        <span className="text-sm">{isMpesaMethod(method) ? `M-Pesa - ${method.phoneNumber || `•••• ${method.last4}`}` : `${method.type} - **** ${method.last4}`}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-sm" style={{ marginTop: '10px', marginBottom: 0, color: 'var(--text-muted)' }}>
                    {getSelectedPaymentProvider() === 'STRIPE'
                      ? 'Card payments open a secure Stripe-hosted checkout after the order is created.'
                      : getSelectedPaymentProvider() === 'MPESA'
                        ? 'M-Pesa payments send an STK push to the saved phone number on your account.'
                        : 'Cash on delivery keeps the order unpaid until delivery.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="outline" fullWidth onClick={() => setShowCheckoutConfirm(false)} disabled={isSubmittingOrder}>
                    Back
                  </Button>
                  <Button fullWidth onClick={submitOrder} disabled={isSubmittingOrder}>
                    {isSubmittingOrder ? 'Processing...' : 'Confirm & Place Order'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
