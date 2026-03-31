import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { User, Store, Navigation, Shield } from 'lucide-react';

export function Landing() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '24px' }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px' }}>fikisha.</h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '40px' }}>Select your portal</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          
          <Link to="/customer/login" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', height: '100%' }} hoverable>
              <div style={{ padding: '16px', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--primary)', borderRadius: 'var(--radius-lg)' }}>
                <User size={32} />
              </div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Customer</h3>
                <p className="text-sm text-muted">Shop from nearby stores</p>
              </div>
            </Card>
          </Link>

          <Link to="/merchant/login" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', height: '100%' }} hoverable>
              <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: 'var(--radius-lg)' }}>
                <Store size={32} />
              </div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Merchant</h3>
                <p className="text-sm text-muted">Manage your store operations</p>
              </div>
            </Card>
          </Link>

          <Link to="/driver/login" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', height: '100%' }} hoverable>
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 'var(--radius-lg)' }}>
                <Navigation size={32} />
              </div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Driver</h3>
                <p className="text-sm text-muted">Join the delivery fleet</p>
              </div>
            </Card>
          </Link>

          <Link to="/admin/login" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', height: '100%' }} hoverable>
              <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: 'var(--radius-lg)' }}>
                <Shield size={32} />
              </div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '8px' }}>Admin</h3>
                <p className="text-sm text-muted">Platform management</p>
              </div>
            </Card>
          </Link>

        </div>
      </div>
    </div>
  );
}
