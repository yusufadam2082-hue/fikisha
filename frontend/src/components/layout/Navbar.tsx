import { Search, ShoppingBag, LogOut, User, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';
import { useLocation } from '../../context/LocationContext';

export function Navbar() {
  const { items, setIsCartOpen } = useCart();
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery, searchInputRef } = useSearch();
  const { activeLocation, openLocationSelector } = useLocation();
  const navigate = useNavigate();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const homeByRole = user?.role === 'ADMIN'
    ? '/admin'
    : user?.role === 'MERCHANT'
      ? '/merchant'
      : user?.role === 'DRIVER'
        ? '/driver'
        : '/customer';
  const profilePath = user?.role === 'CUSTOMER' ? '/customer/profile' : '/profile';

  const handleLogout = () => {
    const redirectPath = user?.role === 'CUSTOMER'
      ? '/customer/login'
      : user?.role === 'MERCHANT'
        ? '/merchant/login'
        : '/login';
    logout();
    navigate(redirectPath);
  };

  return (
    <nav className="glass hidden-scroll" style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)' }}>
      <div className="container flex-between nav-header-mobile" style={{ height: '72px' }}>
        <div className="flex-center" style={{ gap: '16px' }}>
          <Link to={homeByRole} className="text-h2" style={{ color: 'var(--primary)', letterSpacing: '-1px', fontSize: '2.0rem' }}>
            fikisha.
          </Link>
          {user?.role === 'CUSTOMER' && (
            <button
              type="button"
              onClick={openLocationSelector}
              title="Set delivery location"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: activeLocation ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                maxWidth: '200px', overflow: 'hidden',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <MapPin size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeLocation ? activeLocation.label : 'Set location'}
              </span>
            </button>
          )}
        </div>

        {/* Mobile-only top-row actions: shown only on small screens */}
        {user && (
          <div className="mobile-topbar-actions">
            <Link
              to={profilePath}
              title="Profile"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-hover)', color: 'var(--text-main)' }}
            >
              <User size={20} />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
            >
              <LogOut size={20} />
            </button>
          </div>
        )}

        <div className="input-wrapper mobile-search-bar" style={{ flex: 1, maxWidth: '400px', margin: '0 24px' }}>
          <Search className="input-icon" size={20} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for restaurants, groceries, or items..."
            className="input-field"
            style={{ padding: '12px 20px 12px 48px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-center" style={{ gap: '12px' }}>
          {user && (
            /* Grouped pill: profile + divider + logout as one visual unit */
            <div className="desktop-logout-pill" style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              overflow: 'hidden',
              background: 'var(--surface)',
            }}>
              <Link
                to={profilePath}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  color: 'var(--text-main)',
                  textDecoration: 'none',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <User size={18} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Hi, {user.name || user.username}
                </span>
              </Link>

              {/* Divider */}
              <span style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border)' }} />

              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast), color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FEE2E2';
                  e.currentTarget.style.color = 'var(--error, #DC2626)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          )}

          {/* Cart — sole primary CTA */}
          <button
            type="button"
            className="btn-primary desktop-logout-pill"
            style={{ padding: '10px 20px', position: 'relative' }}
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingBag size={20} />
            {itemCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: 'var(--secondary)',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}>
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}