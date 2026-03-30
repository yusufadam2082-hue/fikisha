import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (isLoading) return;
    setError('');
    setIsLoading(true);
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
        const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$/;
        const phoneRegex = /^\+[1-9]\d{7,14}$/;

        if (!fullName.trim()) {
          setError('Full Name is required');
          return;
        }

        if (!emailRegex.test(email.trim())) {
          setError('Enter a valid email address');
          return;
        }

        if (!phoneRegex.test(phone.replace(/\s+/g, '').trim())) {
          setError('Enter phone in international format (e.g. +255700000000)');
          return;
        }

        if (!username.trim()) {
          setError('Username is required');
          return;
        }

        if (!password) {
          setError('Password is required');
          return;
        }

        if (!confirmPassword) {
          setError('Confirm Password is required');
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        if (dateOfBirth.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
          setError('Date of Birth must use YYYY-MM-DD');
          return;
        }

        const { token, user } = await registerUser({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.replace(/\s+/g, '').trim(),
          username: username.trim(),
          password,
          confirmPassword,
          country: country.trim() || null,
          referralCode: referralCode.trim() || null,
          dateOfBirth: dateOfBirth.trim() || null,
          gender: gender.trim() || null,
          address: address.trim() || null
        });
        login({ ...user, token });
        navigate('/customer');
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username && password) void handleSubmit();
  };

  const handleGuestLogin = () => {
    // Generate a secure enough guest token string / random id for session
    const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
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
        <h1 className="text-h1" style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '-1px' }}>fikisha.</h1>
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
            {view === 'register' && (
              <>
                <input
                  className="input-field"
                  placeholder="Full Name"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="input-field"
                  placeholder="Email Address"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="input-field"
                  placeholder="Phone Number (+country code)"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </>
            )}
            <input
              className="input-field"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              autoComplete={view === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            {view === 'register' && (
              <>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="input-field"
                  placeholder="Country / Location"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="input-field"
                  placeholder="Referral Code"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="input-field"
                  placeholder="Date of Birth (YYYY-MM-DD)"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <select
                  className="input-field"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                >
                  <option value="">Gender (optional)</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                <textarea
                  className="input-field"
                  placeholder="Address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '84px' }}
                />
              </>
            )}
            {error && <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>}

            <Button onClick={handleSubmit} disabled={isLoading || !username || !password || (view === 'register' && (!fullName || !email || !phone || !confirmPassword))}>
              {isLoading ? 'Please wait…' : view === 'login' ? 'Sign In' : 'Sign Up'}
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
      </div>
    </div>
  );
}
