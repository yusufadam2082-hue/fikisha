import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
  requiredPermissions?: string[];
}

export function ProtectedRoute({ children, allowedRoles, requiredPermissions }: ProtectedRouteProps) {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    const isMerchant = location.pathname.startsWith('/merchant');
    const isDriver = location.pathname.startsWith('/driver');
    const isAdmin = location.pathname.startsWith('/admin');
    
    if (isMerchant) return <Navigate to="/merchant/login" replace />;
    if (isDriver) return <Navigate to="/driver/login" replace />;
    if (isAdmin) return <Navigate to="/admin/login" replace />;
    return <Navigate to="/customer/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If the authenticated user is accessing a platform they don't have access to,
    // explicitly prevent them by returning to their own safe portal or forcing a re-login.
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'MERCHANT') return <Navigate to="/merchant" replace />;
    if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
    return <Navigate to="/customer" replace />;
  }

  if (user.role === 'ADMIN' && requiredPermissions && requiredPermissions.length > 0) {
    const hasAccess = requiredPermissions.every((permission) => hasPermission(permission));
    if (!hasAccess) {
      return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />;
    }
  }

  return <>{children}</>;
}
