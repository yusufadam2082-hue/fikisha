import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';
import { X, Minus, Plus, ShoppingBag, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatKES } from '../../utils/currency';

const DELIVERY_FEE = 1.99;

interface StoredPaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

function getAuthHeaders(): HeadersInit {
  const user = JSON.parse(localStorage.getItem('fikisha_auth') || '{}');
  return {
    'Content-Type': 'application/json',
    ...(user.token ? { Authorization: `Bearer ${user.token}` } : {})
  };
}

export function CartModal() {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, total, clearCart } = useCart();
  const { deliveryAddress, setDeliveryAddress } = useLocation();
  const { user, logout } = useAuth();
  // Issue 25: replace alert() with toast notifications
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<StoredPaymentMethod[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('cod');

  useEffect(() => {
    if (!isCartOpen) {
      setShowCheckoutConfirm(false);
      return;
    }

    setConfirmedAddress(deliveryAddress || '');
    const storedPaymentMethods = JSON.parse(localStorage.getItem('fikisha_payment_methods') || '[]') as StoredPaymentMethod[];
    const validStored = Array.isArray(storedPaymentMethods) ? storedPaymentMethods : [];
    setPaymentMethods(validStored);
    const defaultPayment = validStored.find((method) => method.isDefault) || validStored[0];
    setSelectedPaymentId(defaultPayment?.id || 'cod');
  }, [isCartOpen, deliveryAddress]);

  const selectedPayment = selectedPaymentId === 'cod'
    ? null
    : paymentMethods.find((method) => method.id === selectedPaymentId) || null;

  const getPaymentLabel = () => {
    if (!selectedPayment) {
      return 'Cash on Delivery';
    }
    return `${selectedPayment.type} •••• ${selectedPayment.last4}`;
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
    const orderData = {
      storeId,
      items,
      total: total + DELIVERY_FEE,
      customerInfo: {
        name: 'Customer',
        address: confirmedAddress.trim(),
        paymentMethod: getPaymentLabel()
      }
    };

    try {
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
      // Keep orderId in the URL so tracking survives reloads and can be shared.
      const orderId = data.id || data.order?.id;
      if (orderId) {
        navigate(`/customer/tracking/${encodeURIComponent(String(orderId))}`, { state: { orderId } });
      } else {
        navigate('/customer/tracking');
      }
    } catch (err) {
      console.error('Failed to submit order', err);
      showToast('Network error. Please try again.', 'error');
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

    if (!deliveryAddress) {
      showToast('Please add a delivery address in Profile -> Addresses', 'error');
      return;
    }

    setConfirmedAddress(deliveryAddress);
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
            <ShoppingBag size={24} color="var(--primary)" />
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
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ fontWeight: 600, width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <span className="text-body text-muted">Subtotal</span>
              <span className="text-body">{formatKES(total)}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <span className="text-body text-muted">Delivery Fee</span>
              <span className="text-body">{formatKES(DELIVERY_FEE)}</span>
            </div>
            {!showCheckoutConfirm ? (
              <Button
                fullWidth
                size="lg"
                style={{ fontSize: '1.1rem' }}
                onClick={handleCheckout}
              >
                Checkout - {formatKES(total + DELIVERY_FEE)}
              </Button>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-center" style={{ gap: '8px', justifyContent: 'flex-start', marginBottom: '8px' }}>
                    <MapPin size={16} color="var(--primary)" />
                    <p className="text-sm" style={{ fontWeight: 700, margin: 0 }}>Confirm Delivery Address</p>
                  </div>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={confirmedAddress}
                    onChange={(e) => setConfirmedAddress(e.target.value)}
                    style={{ width: '100%' }}
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
                        <span className="text-sm">{method.type} - **** {method.last4}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="outline" fullWidth onClick={() => setShowCheckoutConfirm(false)}>
                    Back
                  </Button>
                  <Button fullWidth onClick={submitOrder}>
                    Confirm & Place Order
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
