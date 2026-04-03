import { Home, Package, Wallet, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import './CustomerNavRedesign.css';

export function MobileNav() {
  const { items, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
            <Wallet size={24} />
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
      <Link to="/customer" className={`mobile-nav-item ${location.pathname === '/customer' ? 'active' : ''}`}>
        <Home size={22} />
        <span>Home</span>
      </Link>

      <Link
        to="/customer/tracking"
        className={`mobile-nav-item ${location.pathname.startsWith('/customer/tracking') ? 'active' : ''}`}
      >
        <Package size={22} />
        <span>Activity</span>
      </Link>

      <Link 
        to="/customer/wallet" 
        className={`mobile-nav-item ${location.pathname.startsWith('/customer/wallet') ? 'active' : ''}`}
      >
        <Wallet size={22} />
        <span>Wallet</span>
      </Link>

      <Link
        to={profilePath}
        className={`mobile-nav-item ${location.pathname === profilePath ? 'active' : ''}`}
      >
        <User size={22} />
        <span>Profile</span>
      </Link>
    </nav>
  );
}
