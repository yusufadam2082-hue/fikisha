import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export function MobileNav() {
  const { items, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Determine paths based on role
  const homePath = user?.role === 'ADMIN' ? '/admin' : user?.role === 'MERCHANT' ? '/merchant' : user?.role === 'DRIVER' ? '/driver' : '/customer';
  const profilePath = user?.role === 'CUSTOMER' ? '/customer/profile' : '/profile';

  return (
    <div className="mobile-nav glass">
      <Link to={homePath} className={`nav-item ${location.pathname === homePath ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
      </Link>
      
      {/* Search navigates to home with focus on search bar or scrolls to top */}
      <Link to={homePath} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`nav-item`}>
        <Search size={24} />
        <span>Search</span>
      </Link>

      <div className="nav-item" onClick={() => setIsCartOpen(true)} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'relative' }}>
          <ShoppingBag size={24} />
          {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
        </div>
        <span>Cart</span>
      </div>

      <Link to={profilePath} className={`nav-item ${location.pathname === profilePath ? 'active' : ''}`}>
        <User size={24} />
        <span>Profile</span>
      </Link>
    </div>
  );
}
