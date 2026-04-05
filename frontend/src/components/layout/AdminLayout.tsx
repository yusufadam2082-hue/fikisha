import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Store, LayoutDashboard, Settings, LogOut, Navigation, Megaphone, Wallet, ShoppingBag, Users, BarChart3, ShieldCheck, BriefcaseBusiness } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_PERMISSION_KEYS } from '../../utils/adminRbac';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const { user, hasPermission, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, permission: ADMIN_PERMISSION_KEYS.viewDashboard },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingBag, permission: ADMIN_PERMISSION_KEYS.viewOrders },
    { name: 'Customers', path: '/admin/customers', icon: Users, permission: ADMIN_PERMISSION_KEYS.viewCustomers },
    { name: 'Merchants', path: '/admin/stores', icon: Store, permission: ADMIN_PERMISSION_KEYS.viewMerchants },
    { name: 'Drivers', path: '/admin/drivers', icon: Navigation, permission: ADMIN_PERMISSION_KEYS.viewDrivers },
    { name: 'Promotions', path: '/admin/promotions', icon: Megaphone, permission: ADMIN_PERMISSION_KEYS.viewPromotions },
    { name: 'Payouts', path: '/admin/payouts', icon: Wallet, permission: ADMIN_PERMISSION_KEYS.viewPayouts },
    { name: 'COD Reconciliation', path: '/admin/cod-reconciliation', icon: BriefcaseBusiness, permission: ADMIN_PERMISSION_KEYS.viewCodReconciliation },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3, permission: ADMIN_PERMISSION_KEYS.viewReports },
    { name: 'Admins', path: '/admin/admins', icon: ShieldCheck, permission: ADMIN_PERMISSION_KEYS.viewAdmins },
    { name: 'Roles & Permissions', path: '/admin/roles', icon: ShieldCheck, permission: ADMIN_PERMISSION_KEYS.manageRolesPermissions },
    { name: 'Settings', path: '/admin/settings', icon: Settings, permission: ADMIN_PERMISSION_KEYS.viewSettings },
  ].filter((item) => hasPermission(item.permission));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <aside style={{ width: '280px', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-h2" style={{ color: 'var(--primary)', letterSpacing: '-1px' }}>Mtaaexpress admin.</h2>
          <p className="text-sm text-muted" style={{ marginTop: '8px' }}>{user?.name || 'Admin'} • {user?.adminRoleName || 'RBAC role'}</p>
        </div>
        
        <nav style={{ padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/admin');
            
            return (
              <Link 
                key={item.path} 
                to={item.path}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'rgba(255, 90, 95, 0.1)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-main)',
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
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: 'var(--text-muted)', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer' }}>
            <LogOut size={20} />
            <span>Logout</span>
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
