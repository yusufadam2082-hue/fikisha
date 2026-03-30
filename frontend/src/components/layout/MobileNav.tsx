import { Home, Package, ShoppingBag, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import './CustomerNavRedesign.css';

export function MobileNav() {
  const { items, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Determine paths based on role
  const homePath = user?.role === 'ADMIN' ? '/admin' : user?.role === 'MERCHANT' ? '/merchant' : user?.role === 'DRIVER' ? '/driver' : '/customer';
  const profilePath = user?.role === 'CUSTOMER' ? '/customer/profile' : '/profile';

  const isCustomer = user?.role === 'CUSTOMER';

  if (!isCustomer) {
    return (
      <div className="mobile-nav glass">
        <Link to={homePath} className={`nav-item ${location.pathname === homePath ? 'active' : ''}`}>
          <Home size={24} />
          <span>Home</span>
        </Link>

        <button type="button" className="nav-item" onClick={() => setIsCartOpen(true)} aria-label="Open cart">
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={24} />
            {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
          </div>
          <span>Cart</span>
        </button>

        <Link to={profilePath} className={`nav-item ${location.pathname === profilePath ? 'active' : ''}`}>
          <User size={24} />
          <span>Profile</span>
        </Link>
      </div>
    );
  }

  return (
    <nav className="customer-mobile-nav" aria-label="Customer mobile navigation">
      <Link to="/customer" className={`customer-mobile-item ${location.pathname === '/customer' ? 'active' : ''}`}>
        <Home size={20} />
        <span>Home</span>
      </Link>

      <Link
        to="/customer/tracking"
        className={`customer-mobile-item ${location.pathname.startsWith('/customer/tracking') ? 'active' : ''}`}
      >
        <Package size={20} />
        <span>Activity</span>
      </Link>

      <button type="button" className="customer-mobile-item" onClick={() => setIsCartOpen(true)}>
        <div className="customer-mobile-badge-wrap">
          <ShoppingBag size={20} />
          {itemCount > 0 && <span className="customer-mobile-badge">{itemCount}</span>}
        </div>
        <span>Wallet</span>
      </button>

      <Link
        to={profilePath}
        className={`customer-mobile-item ${location.pathname === profilePath ? 'active' : ''}`}
      >
        <User size={20} />
        <span>Profile</span>
      </Link>
    </nav>
  );
}
