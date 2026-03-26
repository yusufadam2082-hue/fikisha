import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Store as StoreIcon,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';

interface MerchantLayoutProps {
  children: ReactNode;
}

export function MerchantLayout({ children }: MerchantLayoutProps) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { stores } = useStoreContext();

  const store = stores.find(s => s.id === user?.storeId);

  const navItems = [
    { name: 'Dashboard', path: '/merchant/dashboard', icon: LayoutDashboard },
    { name: 'Orders', path: '/merchant/orders', icon: ShoppingBag },
    { name: 'Catalog', path: '/merchant/products', icon: Package },
    { name: 'Inventory', path: '/merchant/inventory', icon: Package },
    { name: 'Promotions', path: '/merchant/promotions', icon: Megaphone },
    { name: 'Reports', path: '/merchant/reports', icon: BarChart3 },
    { name: 'Payouts', path: '/merchant/payouts', icon: CircleDollarSign },
    { name: 'Reviews', path: '/merchant/reviews', icon: Star },
    { name: 'Support', path: '/merchant/support', icon: Wrench },
    { name: 'Settings', path: '/merchant/settings', icon: Settings },
    { name: 'Store Profile', path: '/merchant/profile', icon: StoreIcon },
  ];

  if (!store) return <div style={{ padding: '48px' }}>Store Data Not Found. Please re-login.</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <aside style={{ width: '280px', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src={store.image} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h3 className="text-h3" style={{ fontSize: '1rem', marginBottom: '2px' }}>{store.name}</h3>
            <span className="text-sm text-muted">Merchant Portal</span>
          </div>
        </div>
        
        <nav style={{ padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isOrdersRoot = item.path === '/merchant/orders' && location.pathname === '/merchant';
            const isActive = isOrdersRoot || location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            
            return (
              <Link 
                key={item.path} 
                to={item.path}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                  color: isActive ? '#22c55e' : 'var(--text-main)',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border)' }}>
          <button 
            onClick={logout}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
              color: 'var(--text-muted)', background: 'transparent', border: 'none', 
              width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '1rem',
              fontFamily: 'inherit'
            }}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '48px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
