import { Bell, LogOut, MapPin, Search, User } from 'lucide-react';
import { Link, useNavigate, useLocation as useRouteLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';
import { useLocation } from '../../context/LocationContext';
import './CustomerNavRedesign.css';

export function Navbar() {
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery, searchInputRef } = useSearch();
  const { activeLocation, openLocationSelector } = useLocation();
  const navigate = useNavigate();
  const routeLocation = useRouteLocation();
  const homeByRole = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MERCHANT'
      ? '/merchant'
      : user?.role === 'DRIVER'
        ? '/driver'
        : '/customer';
  const profilePath = user?.role === 'CUSTOMER' ? '/customer/profile' : '/profile';
  const isCustomer = user?.role === 'CUSTOMER';
  const userInitial = (user?.name || user?.username || 'U').charAt(0).toUpperCase();

  const handleLogout = () => {
    const redirectPath = user?.role === 'CUSTOMER'
      ? '/customer/login'
      : user?.role === 'MERCHANT'
        ? '/merchant/login'
        : '/login';
    logout();
    navigate(redirectPath);
  };

  if (!isCustomer) {
    return (
      <nav className="glass hidden-scroll" style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)' }}>
        <div className="container flex-between nav-header-mobile" style={{ height: '72px' }}>
          <div className="flex-center" style={{ gap: '16px' }}>
            <Link to={homeByRole} className="text-h2" style={{ color: 'var(--primary)', letterSpacing: '-1px', fontSize: '2.0rem' }}>
              Mtaaexpress
            </Link>
          </div>

          <div className="input-wrapper mobile-search-bar" style={{ flex: 1, maxWidth: '400px', margin: '0 24px' }}>
            <Search className="input-icon" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              className="input-field"
              style={{ padding: '12px 20px 12px 48px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex-center" style={{ gap: '12px' }}>
            <Link to={profilePath} className="btn-icon" title="Profile">
              <User size={18} />
            </Link>
            <button type="button" className="btn-icon" title="Sign out" onClick={handleLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <header className="customer-topbar">
      <nav className="customer-topbar-inner">
        <div className="customer-brand-side">
          <Link to={homeByRole} className="customer-brand">Mtaaexpress</Link>

          <div className="customer-search-desktop">
            <Search size={16} className="customer-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for food, groceries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="customer-search-mobile">
            <Search size={18} className="customer-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="customer-actions-side">
          <div className="customer-nav-links" aria-label="Primary">
            <Link to="/customer" className={routeLocation.pathname === '/customer' ? 'active' : ''}>Home</Link>
            <Link to="/customer/tracking" className={routeLocation.pathname.startsWith('/customer/tracking') ? 'active' : ''}>Activity</Link>
            <Link to="/customer/wallet" className={routeLocation.pathname.startsWith('/customer/wallet') ? 'active' : ''}>Wallet</Link>
          </div>

          <button type="button" className="customer-location-pill" onClick={openLocationSelector}>
            <MapPin size={15} />
            <span>{activeLocation ? activeLocation.label : 'Set location'}</span>
          </button>

          <button
            type="button"
            className="customer-circle-btn"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={17} />
          </button>

          <Link to={profilePath} className="customer-avatar" title="Profile">
            <span>{userInitial}</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
