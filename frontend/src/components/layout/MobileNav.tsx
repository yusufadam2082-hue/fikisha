import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';

export function MobileNav() {
  const { items, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const { focusSearch } = useSearch();
  const location = useLocation();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Determine paths based on role
  const homePath = user?.role === 'ADMIN' ? '/admin' : user?.role === 'MERCHANT' ? '/merchant' : user?.role === 'DRIVER' ? '/driver' : '/customer';
  const profilePath = user?.role === 'CUSTOMER' ? '/customer/profile' : '/profile';

  const handleSearchTap = (e: React.MouseEvent) => {
    e.preventDefault();
    focusSearch();
  };

  return (
    <div className="mobile-nav glass">
      <Link to={homePath} className={`nav-item ${location.pathname === homePath ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
      </Link>

      {/* Search: focuses the navbar search input */}
      <a href="#search" className="nav-item" onClick={handleSearchTap} role="button" aria-label="Search">
        <Search size={24} />
        <span>Search</span>
      </a>

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
