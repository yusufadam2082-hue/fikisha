import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, loginUser, loginDriver } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Shield, Navigation } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const [driverUsername, setDriverUsername] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [driverError, setDriverError] = useState('');

  const handleAdminLogin = async () => {
    setAdminError('');
    try {
      const { token, user } = await loginUser(adminUsername, adminPassword);
      if (user.role !== 'ADMIN') {
        setAdminError('Invalid admin credentials');
        return;
      }
      login({ ...user, token });
      navigate('/admin');
    } catch (e: any) {
      setAdminError(e.message || 'Invalid credentials');
    }
  };

  const handleDriverLogin = async () => {
    setDriverError('');
    try {
      const { token, driver } = await loginDriver(driverUsername, driverPassword);
      login({
        id: driver.userId,
        username: driver.username,
        name: driver.name,
        role: 'DRIVER',
        driverId: driver.id,
        token
      });
      navigate('/driver');
    } catch (e: any) {
      setDriverError(e.message || 'Invalid credentials');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '24px' }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px', fontSize: '3rem' }}>fikisha.</h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '12px' }}>Staff Login Portal</p>
        <p className="text-sm text-muted" style={{ textAlign: 'center', marginBottom: '40px' }}>
          Customer? Use <strong>/customer/login</strong>. Merchant? Use <strong>/merchant/login</strong>.
        </p>

        <div style={{ display: 'grid', gap: '24px' }}>
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} hoverable={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: 'var(--radius-lg)' }}>
                <Shield size={32} />
              </div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '4px' }}>System Admin</h3>
                <p className="text-sm text-muted">Approve stores, view platform statistics.</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                className="input-field" 
                placeholder="Admin Username"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
              />
              <input 
                className="input-field" 
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
              />
              {adminError && <p className="text-sm" style={{ color: 'var(--error)' }}>{adminError}</p>}
              <Button onClick={handleAdminLogin} disabled={!adminUsername || !adminPassword}>
                Login as Admin
              </Button>
            </div>
          </Card>

          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} hoverable={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 'var(--radius-lg)' }}>
                <Navigation size={32} />
              </div>
              <div>
                <h3 className="text-h3" style={{ marginBottom: '4px' }}>Driver Portal</h3>
                <p className="text-sm text-muted">Join the fleet, accept deliveries, and earn money.</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                className="input-field" 
                placeholder="Driver Username"
                value={driverUsername}
                onChange={e => setDriverUsername(e.target.value)}
              />
              <input 
                className="input-field" 
                type="password"
                placeholder="Password"
                value={driverPassword}
                onChange={e => setDriverPassword(e.target.value)}
              />
              {driverError && <p className="text-sm" style={{ color: 'var(--error)' }}>{driverError}</p>}
              <Button onClick={handleDriverLogin} disabled={!driverUsername || !driverPassword}>
                Login to Fleet
              </Button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}