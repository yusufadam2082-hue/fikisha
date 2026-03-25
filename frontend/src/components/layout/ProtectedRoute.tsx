import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    const customerPath = location.pathname.startsWith('/customer');
    const merchantPath = location.pathname.startsWith('/merchant');
    return <Navigate to={customerPath ? '/customer/login' : merchantPath ? '/merchant/login' : '/login'} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their respective dashboards if they try to access the wrong one
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'MERCHANT') return <Navigate to="/merchant" replace />;
    if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
    return <Navigate to="/customer" replace />;
  }

  return <>{children}</>;
}
