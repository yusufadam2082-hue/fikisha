import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, loginUser, registerUser } from '../context/AuthContext';
import { User, UserPlus, ArrowRight } from 'lucide-react';
import './CustomerLogin.css';

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
    const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
    login({
      id: guestId,
      username: 'Guest',
      name: 'Guest User',
      role: 'CUSTOMER',
      token: ''
    });
    navigate('/customer');
  };

  const switchView = (newView: 'login' | 'register') => {
    setView(newView);
    setError('');
  };

  const isLoginDisabled = isLoading || !username || !password;
  const isRegisterDisabled = isLoading || !username || !password || !fullName || !email || !phone || !confirmPassword;

  return (
    <div className="cl-shell">
      <div className="cl-wrapper">
        <div className="cl-brand">
          <span className="cl-brand-name">fikisha.</span>
          <p className="cl-brand-sub">Customer Portal</p>
        </div>

        <div className="cl-card">
          <div className="cl-tabs">
            <button
              type="button"
              className={`cl-tab${view === 'login' ? ' active' : ''}`}
              onClick={() => switchView('login')}
            >
              <User size={16} /> Sign In
            </button>
            <button
              type="button"
              className={`cl-tab${view === 'register' ? ' active' : ''}`}
              onClick={() => switchView('register')}
            >
              <UserPlus size={16} /> Create Account
            </button>
          </div>

          <div className="cl-fields">
            {view === 'register' && (
              <>
                <input
                  className="cl-input"
                  placeholder="Full Name"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="cl-input"
                  placeholder="Email Address"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="cl-input"
                  placeholder="Phone Number (+country code)"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </>
            )}
            <input
              className="cl-input"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input
              className="cl-input"
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
                  className="cl-input"
                  type="password"
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="cl-input"
                  placeholder="Country / Location"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="cl-input"
                  placeholder="Referral Code (optional)"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="cl-input"
                  placeholder="Date of Birth (YYYY-MM-DD)"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <select
                  className="cl-select"
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
                  className="cl-textarea"
                  placeholder="Address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                />
              </>
            )}

            {error && <p className="cl-error">{error}</p>}

            <button
              className="cl-btn-primary"
              onClick={handleSubmit}
              disabled={view === 'login' ? isLoginDisabled : isRegisterDisabled}
            >
              {isLoading ? 'Please wait\u2026' : view === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="cl-divider">or</div>

            <button className="cl-btn-ghost" onClick={handleGuestLogin}>
              Continue as Guest <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="cl-footer">
          <p>
            {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="cl-footer-link"
              onClick={() => switchView(view === 'login' ? 'register' : 'login')}
            >
              {view === 'login' ? 'Create Account' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
