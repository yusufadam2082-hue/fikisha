import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, loginDriver } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Navigation } from 'lucide-react';

export function DriverLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [driverUsername, setDriverUsername] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [driverError, setDriverError] = useState('');

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
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px' }}>Mtaaexpress</h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '40px' }}>Driver Portal</p>

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
  );
}
