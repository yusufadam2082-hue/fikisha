import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, loginUser, registerUser } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { User, UserPlus, ArrowRight } from 'lucide-react';

export function CustomerLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    try {
      if (view === 'login') {
        const { token, user } = await loginUser(username, password);
        if (user.role !== 'CUSTOMER') {
          setError('This portal is only for customers.');
          return;
        }
        login({ ...user, token });
        navigate('/customer');
      } else {
        const { token, user } = await registerUser(username, password);
        login({ ...user, token });
        navigate('/customer');
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    }
  };

  const handleGuestLogin = () => {
    // Generate a secure enough guest token string / random id for session
    const guestId = `guest_${Math.random().toString(36).substr(2, 9)}`;
    login({
      id: guestId,
      username: 'Guest',
      name: 'Guest User',
      role: 'CUSTOMER',
      token: '' // Guests don't get a JWT, limited privileges are handled elsewhere
    });
    navigate('/customer');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '24px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px', fontSize: '3rem' }}>fikisha.</h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '40px' }}>Customer Portal</p>

        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} hoverable={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ padding: '16px', background: 'rgba(255, 90, 95, 0.1)', color: 'var(--primary)', borderRadius: 'var(--radius-lg)' }}>
              {view === 'login' ? <User size={32} /> : <UserPlus size={32} />}
            </div>
            <div>
              <h3 className="text-h3" style={{ marginBottom: '4px' }}>
                {view === 'login' ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-sm text-muted">Shop from nearby stores and track deliveries.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <input
              className="input-field"
              placeholder="Username"
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
            
            <Button onClick={handleSubmit} disabled={!username || !password}>
              {view === 'login' ? 'Sign In' : 'Sign Up'}
            </Button>
            
            <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: '8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              <span className="text-sm text-muted">or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            </div>

            <Button variant="outline" onClick={handleGuestLogin}>
              Continue as Guest <ArrowRight size={16} />
            </Button>
          </div>
        </Card>

        <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: '24px' }}>
          {view === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => {
              setView(view === 'login' ? 'register' : 'login');
              setError('');
            }}
            style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {view === 'login' ? 'Create Account' : 'Sign In'}
          </button>
        </p>

        <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: '16px' }}>
          Staff member? <Link to="/login" style={{ color: 'var(--primary)' }}>Use staff login</Link>
        </p>

        <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: '8px' }}>
          Merchant? <Link to="/merchant/login" style={{ color: 'var(--primary)' }}>Use merchant portal</Link>
        </p>
      </div>
    </div>
  );
}
