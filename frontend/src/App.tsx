import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { AdminLayout } from './components/layout/AdminLayout';
import { Home } from './pages/Home';
import { StoreDetail } from './pages/StoreDetail';
import { DriverDashboard } from './pages/DriverDashboard';
import { OrderTracking } from './pages/OrderTracking';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StoreManager } from './pages/admin/StoreManager';
import { DriverManager } from './pages/admin/DriverManager';
import { Settings as AdminSettings } from './pages/admin/Settings';
import { Promotions } from './pages/admin/Promotions';
import { AdminPayouts } from './pages/admin/AdminPayouts';
import { StoreProvider } from './context/StoreContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { SearchProvider } from './context/SearchContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Landing } from './pages/Landing';
import { CustomerLogin } from './pages/CustomerLogin';
import { MerchantLogin } from './pages/MerchantLogin';
import { DriverLogin } from './pages/DriverLogin';
import { AdminLogin } from './pages/AdminLogin';
import { MerchantLayout } from './components/layout/MerchantLayout';
import { MerchantDashboard } from './pages/merchant/MerchantDashboard';
import { MerchantOrders } from './pages/merchant/MerchantOrders';
import { MerchantProducts } from './pages/merchant/MerchantProducts';
import { MerchantProfile } from './pages/merchant/MerchantProfile';
import { MerchantInventory } from './pages/merchant/MerchantInventory';
import { MerchantPromotions } from './pages/merchant/MerchantPromotions';
import { MerchantReports } from './pages/merchant/MerchantReports';
import { MerchantPayouts } from './pages/merchant/MerchantPayouts';
import { MerchantReviews } from './pages/merchant/MerchantReviews';
import { MerchantSupport } from './pages/merchant/MerchantSupport';
import { MerchantSettings } from './pages/merchant/MerchantSettings';
import { CustomerProfile } from './pages/CustomerProfile';
import { CustomerWallet } from './pages/customer/CustomerWallet';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './context/ToastContext';
import { NotFound } from './pages/NotFound';
import { About } from './pages/About';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';

// Redirect old URLs to the current customer route structure so older links keep working.
function LegacyStoreRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/customer/store/${id}` : '/customer'} replace />;
}

function LegacyTrackingRedirect() {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={orderId ? `/customer/tracking/${orderId}` : '/customer/tracking'} replace />;
}

function App() {
  return (
    // Keep global safety and app-wide providers near the root so every route can share them.
    <ErrorBoundary>
      <ToastProvider>
      <Router>
      <StoreProvider>
        <CartProvider>
          <AuthProvider>
            <LocationProvider>
              <SearchProvider>
                <Routes>
                {/* Public entry points for signing in or landing on the apps. */}
                <Route path="/" element={<Landing />} />
                <Route path="/customer/login" element={<CustomerLogin />} />
                <Route path="/merchant/login" element={<MerchantLogin />} />
                <Route path="/driver/login" element={<DriverLogin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                
                {/* Customer-facing shopping and account routes. */}
                <Route path="/customer" element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <Layout><Home /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customer/store/:id" element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <Layout><StoreDetail /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customer/tracking" element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <Layout><OrderTracking /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customer/tracking/:orderId" element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <Layout><OrderTracking /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customer/profile" element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <Layout><CustomerProfile /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customer/wallet" element={
                  <ProtectedRoute allowedRoles={['CUSTOMER']}>
                    <Layout><CustomerWallet /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/customer/about" element={<Layout><About /></Layout>} />
                <Route path="/customer/terms" element={<Layout><Terms /></Layout>} />
                <Route path="/customer/privacy" element={<Layout><Privacy /></Layout>} />

                {/* Legacy URLs are redirected so existing bookmarks remain valid. */}
                <Route path="/store/:id" element={<LegacyStoreRedirect />} />
                <Route path="/tracking" element={<Navigate to="/customer/tracking" replace />} />
                <Route path="/tracking/:orderId" element={<LegacyTrackingRedirect />} />
                <Route path="/profile" element={<Navigate to="/customer/profile" replace />} />
                <Route path="/about" element={<Navigate to="/customer/about" replace />} />
                <Route path="/terms" element={<Navigate to="/customer/terms" replace />} />
                <Route path="/privacy" element={<Navigate to="/customer/privacy" replace />} />
              
              {/* Driver route is kept separate because it has a different workflow from shopping. */}
              <Route path="/driver" element={
                <ProtectedRoute allowedRoles={['DRIVER']}>
                  <Layout><DriverDashboard /></Layout>
                </ProtectedRoute>
              } />
              
              {/* Admin screens are wrapped in the admin layout for management tooling. */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout><AdminDashboard /></AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/stores" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout><StoreManager /></AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/drivers" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout><DriverManager /></AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout><AdminSettings /></AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/promotions" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout><Promotions /></AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/payouts" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout><AdminPayouts /></AdminLayout>
                </ProtectedRoute>
              } />

              {/* Merchant screens focus on store operations and order handling. */}
              <Route path="/merchant" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantOrders /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/dashboard" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantDashboard /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/orders" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantOrders /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/products" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantProducts /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/inventory" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantInventory /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/promotions" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantPromotions /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/reports" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantReports /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/payouts" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantPayouts /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/reviews" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantReviews /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/support" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantSupport /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/settings" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantSettings /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="/merchant/profile" element={
                <ProtectedRoute allowedRoles={['MERCHANT']}>
                  <MerchantLayout><MerchantProfile /></MerchantLayout>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
              </Routes>
              </SearchProvider>
            </LocationProvider>
        </AuthProvider>
      </CartProvider>
    </StoreProvider>
  </Router>
      </ToastProvider>
</ErrorBoundary>
  );
}

export default App;
