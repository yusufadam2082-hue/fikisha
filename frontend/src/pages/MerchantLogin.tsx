import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, loginUser } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Store as StoreIcon } from 'lucide-react';

export function MerchantLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleMerchantLogin = async () => {
    setError('');
    try {
      const { token, user } = await loginUser(username, password);
      if (user.role !== 'MERCHANT') {
        setError('This portal is only for merchants.');
        return;
      }
      login({ ...user, token });
      navigate('/merchant');
    } catch (e: any) {
      setError(e.message || 'Invalid merchant credentials');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '24px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px' }}>Mtaaexpress</h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '40px' }}>Merchant Portal</p>

        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} hoverable={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: 'var(--radius-lg)' }}>
              <StoreIcon size={32} />
            </div>
            <div>
              <h3 className="text-h3" style={{ marginBottom: '4px' }}>Manage Your Store</h3>
              <p className="text-sm text-muted">Access orders, products, and store profile from your dedicated merchant workspace.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <input
              className="input-field"
              placeholder="Merchant Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}

            <Button onClick={handleMerchantLogin} disabled={!username || !password}>
              Sign In to Merchant Portal
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}