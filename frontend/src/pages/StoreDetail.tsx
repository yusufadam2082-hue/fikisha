import { useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useStoreContext, type Product } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Star, Clock, Info, ArrowLeft, Minus, Plus } from 'lucide-react';
import { formatKES } from '../utils/currency';

export function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToCart, items, updateQuantity, clearCart } = useCart();
  const { stores } = useStoreContext();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Issue 23: track item pending confirmation when cross-store
  const [confirmClear, setConfirmClear] = useState<Product | null>(null);

  const store = stores.find(s => s.id === id);
  if (!store) return <Navigate to="/customer" />;

  const getCartItem = (itemId: string) => items.find(i => i.id === itemId);

  // Issue 23: prevent silent multi-store cart corruption
  const handleAddToCart = (item: Product) => {
    const cartStoreId = items.length > 0 ? items[0].storeId : null;
    if (cartStoreId && cartStoreId !== store.id) {
      setConfirmClear(item);
    } else {
      addToCart({ id: item.id, name: item.name, price: item.price, storeId: store.id });
    }
  };

  const handleConfirmClear = () => {
    if (!confirmClear) return;
    clearCart();
    addToCart({ id: confirmClear.id, name: confirmClear.name, price: confirmClear.price, storeId: store.id });
    showToast(`Cart cleared. Starting new order from ${store.name}.`, 'info');
    setConfirmClear(null);
  };

  return (
    <div className="animate-fade-in">
      {/* Issue 6: back navigation */}
      <div className="container" style={{ paddingTop: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            color: 'var(--text-muted)', fontWeight: 500, cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft size={18} /> Back to stores
        </button>
      </div>

      {/* Issue 23: cross-store confirmation dialog */}
      {confirmClear && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            padding: '32px', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 className="text-h3" style={{ marginBottom: '12px' }}>Start a new order?</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>
              Your cart has items from a different store. Starting an order from{' '}
              <strong>{store.name}</strong> will clear your current cart.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="outline" onClick={() => setConfirmClear(null)} fullWidth>Cancel</Button>
              <Button onClick={handleConfirmClear} fullWidth>Clear &amp; Start New</Button>
            </div>
          </div>
        </div>
      )}

      {/* Store hero banner */}
      <div style={{ height: '300px', width: '100%', position: 'relative', marginTop: '12px' }}>
        {/* Issue 9: image fallback container */}
        <div style={{ width: '100%', height: '100%', background: 'var(--surface-hover)' }}>
          <img
            src={store.image}
            alt={store.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)'
        }} />
        <div className="container" style={{ position: 'absolute', bottom: '32px', left: 0, right: 0, color: 'white' }}>
          <h1 className="text-h1" style={{ marginBottom: '8px' }}>{store.name}</h1>
          <div className="flex-center" style={{ gap: '16px', justifyContent: 'flex-start' }}>
            <div className="flex-center" style={{ gap: '4px' }}>
              <Star size={18} fill="currentColor" color="var(--accent)" />
              <span style={{ fontWeight: 600 }}>{store.rating}</span>
            </div>
            <span>•</span>
            <div className="flex-center" style={{ gap: '4px' }}>
              <Clock size={18} />
              <span>{store.time}</span>
            </div>
            <span>•</span>
            {/* Issue 10: guard against undefined deliveryFee */}
            <div className="flex-center" style={{ gap: '4px' }}>
              <Info size={18} />
              <span>{store.deliveryFee != null ? `${formatKES(store.deliveryFee)}` : 'Free'} delivery</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: '48px', marginBottom: '48px' }}>
        <p className="text-body text-muted" style={{ marginBottom: '32px', maxWidth: '800px' }}>{store.description}</p>
        <h2 className="text-h2" style={{ marginBottom: '24px' }}>Menu</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
          {store.products.map((item: Product) => {
            const cartItem = getCartItem(item.id);
            return (
              <Card key={item.id} style={{ display: 'flex', padding: '16px', gap: '16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 className="text-h3" style={{ marginBottom: '4px' }}>{item.name}</h3>
                  <p className="text-sm text-muted" style={{ marginBottom: '12px', flex: 1 }}>{item.description}</p>
                  <div className="flex-between">
                    <span className="text-body" style={{ fontWeight: 600 }}>{formatKES(item.price)}</span>
                    {/* Issue 8: cart-aware add button */}
                    {cartItem ? (
                      <div className="flex-center" style={{ gap: '8px', background: 'var(--surface-hover)', padding: '4px', borderRadius: 'var(--radius-pill)' }}>
                        <button
                          onClick={() => updateQuantity(item.id, cartItem.quantity - 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, cartItem.quantity + 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => handleAddToCart(item)}>Add</Button>
                    )}
                  </div>
                </div>
                {/* Issue 9: product image fallback */}
                <div style={{ width: '120px', height: '120px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-hover)' }}>
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
