import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, loginAdmin } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Shield } from 'lucide-react';

export function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [identifier, setIdentifier] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminLogin = async () => {
    setAdminError('');
    try {
      const { token, user } = await loginAdmin(identifier, adminPassword);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '24px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px' }}>Mtaaexpress</h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '40px' }}>Admin Portal</p>

        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} hoverable={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: 'var(--radius-lg)' }}>
              <Shield size={32} />
            </div>
            <div>
              <h3 className="text-h3" style={{ marginBottom: '4px' }}>System Admin</h3>
              <p className="text-sm text-muted">Manage stores, process applications, and ensure platform health.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              className="input-field" 
              placeholder="Email or phone"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
            />
            <input 
              className="input-field" 
              type="password"
              placeholder="Password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
            />
            {adminError && <p className="text-sm" style={{ color: 'var(--error)' }}>{adminError}</p>}
            <Button onClick={handleAdminLogin} disabled={!identifier || !adminPassword}>
              Login to Admin Portal
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
