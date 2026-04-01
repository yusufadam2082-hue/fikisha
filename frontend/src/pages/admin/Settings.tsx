import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth, updateProfile } from '../../context/AuthContext';

const SETTINGS_STORAGE_KEY = 'fikisha_admin_settings';

type AdminSettingsState = {
  general: {
    platformName: string;
    supportEmail: string;
    supportPhone: string;
    currency: string;
    timezone: string;
  };
  orders: {
    defaultStatus: 'pending' | 'confirmed' | 'preparing';
    autoCancelMinutes: number;
    allowCustomerCancellation: boolean;
  };
  delivery: {
    baseFee: number;
    freeDeliveryThreshold: number;
    surgeEnabled: boolean;
    surgeMultiplier: number;
  };
  security: {
    sessionTimeoutMinutes: number;
    passwordMinLength: number;
    require2FAForAdmins: boolean;
  };
  notifications: {
    sendOrderConfirmed: boolean;
    sendOutForDelivery: boolean;
    sendDelivered: boolean;
    orderConfirmedTemplate: string;
    outForDeliveryTemplate: string;
    deliveredTemplate: string;
  };
};

const defaultSettings: AdminSettingsState = {
  general: {
    platformName: 'Fikisha',
    supportEmail: 'support@fikisha.local',
    supportPhone: '+255700000000',
    currency: 'USD',
    timezone: 'Africa/Dar_es_Salaam'
  },
  orders: {
    defaultStatus: 'pending',
    autoCancelMinutes: 15,
    allowCustomerCancellation: true
  },
  delivery: {
    baseFee: 2.99,
    freeDeliveryThreshold: 30,
    surgeEnabled: false,
    surgeMultiplier: 1.25
  },
  security: {
    sessionTimeoutMinutes: 60,
    passwordMinLength: 8,
    require2FAForAdmins: false
  },
  notifications: {
    sendOrderConfirmed: true,
    sendOutForDelivery: true,
    sendDelivered: true,
    orderConfirmedTemplate: 'Your order has been confirmed and is now being prepared.',
    outForDeliveryTemplate: 'Great news! Your order is on the way.',
    deliveredTemplate: 'Delivered. Enjoy your order and thank you for choosing Fikisha.'
  }
};

export function Settings() {
  const { user, updateUser, token } = useAuth();
  const [settings, setSettings] = useState<AdminSettingsState>(defaultSettings);
  const [message, setMessage] = useState('');
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  
  // Admin Account State
  const [accountForm, setAccountForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: ''
  });
  const [accountMessage, setAccountMessage] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Fetch global system settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3002';
        const res = await fetch(`${url}/api/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const parsed = await res.json();
          if (Object.keys(parsed).length > 0) {
            setSettings({
              ...defaultSettings,
              ...parsed,
              general: { ...defaultSettings.general, ...(parsed.general || {}) },
              orders: { ...defaultSettings.orders, ...(parsed.orders || {}) },
              delivery: { ...defaultSettings.delivery, ...(parsed.delivery || {}) },
              security: { ...defaultSettings.security, ...(parsed.security || {}) },
              notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) }
            });
          }
        }
      } catch (error) {
        console.error('Failed to load settings from DB', error);
      }
    };
    if (token) fetchSettings();
  }, [token]);

  const setSectionValue = <Section extends keyof AdminSettingsState, Key extends keyof AdminSettingsState[Section]>(
    section: Section,
    key: Key,
    value: AdminSettingsState[Section][Key]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSavingSystem(true);
    try {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const res = await fetch(`${url}/api/admin/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Network response was not ok');
      setMessage('Platform settings successfully saved to the database.');
      setTimeout(() => setMessage(''), 3500);
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage('Failed to save settings to the database.');
      setTimeout(() => setMessage(''), 3500);
    } finally {
      setIsSavingSystem(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setMessage('Settings reset. Click Save to persist.');
    setTimeout(() => setMessage(''), 2500);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMessage('');
    setIsSavingAccount(true);

    try {
      const updatedUser = await updateProfile({
        name: accountForm.name,
        username: accountForm.username,
        email: accountForm.email || null,
        phone: accountForm.phone || null,
        ...(accountForm.password ? { password: accountForm.password } : {})
      });

      updateUser(updatedUser);
      setAccountForm((currentForm) => ({ ...currentForm, password: '' }));
      setAccountMessage('Admin account updated successfully.');
      setTimeout(() => setAccountMessage(''), 3000);
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Failed to update admin account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      
      {/* Admin Account Settings Card */}
      <h1 className="text-h1" style={{ marginBottom: '8px' }}>Admin Profile</h1>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Manage your admin login credentials and personal info.</p>
      
      <Card style={{ padding: '24px', marginBottom: '40px' }}>
        <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div>
              <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Full Name</label>
              <input className="input-field" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Username</label>
              <input className="input-field" value={accountForm.username} onChange={e => setAccountForm({ ...accountForm, username: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Email Address</label>
              <input className="input-field" type="email" value={accountForm.email} onChange={e => setAccountForm({ ...accountForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Phone Number</label>
              <input className="input-field" value={accountForm.phone} onChange={e => setAccountForm({ ...accountForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>New Password</label>
            <input className="input-field" type="password" placeholder="Leave blank to keep current password" value={accountForm.password} onChange={e => setAccountForm({ ...accountForm, password: e.target.value })} />
          </div>
          {accountMessage && (
            <p className="text-sm" style={{ color: accountMessage.includes('successfully') ? 'var(--success, #16a34a)' : 'var(--error)' }}>
              {accountMessage}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button type="submit" disabled={isSavingAccount}>
              {isSavingAccount ? 'Saving...' : 'Update Admin Account'}
            </Button>
          </div>
        </form>
      </Card>

      <div style={{ height: '1px', background: 'var(--border)', margin: '40px 0' }}></div>

      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-h1">Platform Settings</h1>
          <p className="text-muted">Global system logic used by Fikisha application.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={handleReset}>Reset defaults</Button>
          <Button onClick={handleSave} disabled={isSavingSystem}>
            {isSavingSystem ? 'Saving...' : 'Save platform settings'}
          </Button>
        </div>
      </div>

      {message && (
        <Card style={{ padding: '12px 16px', marginBottom: '24px' }}>
          <p className="text-sm" style={{ color: 'var(--primary)' }}>{message}</p>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <Card style={{ padding: '24px' }}>
          <h2 className="text-h3" style={{ marginBottom: '16px' }}>General</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input className="input-field" placeholder="Platform Name" value={settings.general.platformName} onChange={(e) => setSectionValue('general', 'platformName', e.target.value)} />
            <input className="input-field" placeholder="Support Email" type="email" value={settings.general.supportEmail} onChange={(e) => setSectionValue('general', 'supportEmail', e.target.value)} />
            <input className="input-field" placeholder="Support Phone" value={settings.general.supportPhone} onChange={(e) => setSectionValue('general', 'supportPhone', e.target.value)} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <input className="input-field" placeholder="Currency" value={settings.general.currency} onChange={(e) => setSectionValue('general', 'currency', e.target.value.toUpperCase())} />
              <input className="input-field" placeholder="Timezone" value={settings.general.timezone} onChange={(e) => setSectionValue('general', 'timezone', e.target.value)} />
            </div>
          </div>
        </Card>

        <Card style={{ padding: '24px' }}>
          <h2 className="text-h3" style={{ marginBottom: '16px' }}>Order Workflow</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <select className="input-field" value={settings.orders.defaultStatus} onChange={(e) => setSectionValue('orders', 'defaultStatus', e.target.value as AdminSettingsState['orders']['defaultStatus'])}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
            </select>
            <input className="input-field" type="number" min={1} value={settings.orders.autoCancelMinutes} onChange={(e) => setSectionValue('orders', 'autoCancelMinutes', Number(e.target.value || 1))} />
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={settings.orders.allowCustomerCancellation} onChange={(e) => setSectionValue('orders', 'allowCustomerCancellation', e.target.checked)} />
              Allow customer cancellation
            </label>
          </div>
        </Card>

        <Card style={{ padding: '24px' }}>
          <h2 className="text-h3" style={{ marginBottom: '16px' }}>Delivery Rules</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input className="input-field" type="number" min={0} step="0.01" value={settings.delivery.baseFee} onChange={(e) => setSectionValue('delivery', 'baseFee', Number(e.target.value || 0))} />
            <input className="input-field" type="number" min={0} value={settings.delivery.freeDeliveryThreshold} onChange={(e) => setSectionValue('delivery', 'freeDeliveryThreshold', Number(e.target.value || 0))} />
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={settings.delivery.surgeEnabled} onChange={(e) => setSectionValue('delivery', 'surgeEnabled', e.target.checked)} />
              Enable surge pricing
            </label>
            <input className="input-field" type="number" min={1} step="0.01" disabled={!settings.delivery.surgeEnabled} value={settings.delivery.surgeMultiplier} onChange={(e) => setSectionValue('delivery', 'surgeMultiplier', Number(e.target.value || 1))} />
          </div>
        </Card>

        <Card style={{ padding: '24px' }}>
          <h2 className="text-h3" style={{ marginBottom: '16px' }}>Security</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input className="input-field" type="number" min={5} value={settings.security.sessionTimeoutMinutes} onChange={(e) => setSectionValue('security', 'sessionTimeoutMinutes', Number(e.target.value || 5))} />
            <input className="input-field" type="number" min={6} value={settings.security.passwordMinLength} onChange={(e) => setSectionValue('security', 'passwordMinLength', Number(e.target.value || 6))} />
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={settings.security.require2FAForAdmins} onChange={(e) => setSectionValue('security', 'require2FAForAdmins', e.target.checked)} />
              Require 2FA for admins
            </label>
          </div>
        </Card>
      </div>

      <Card style={{ padding: '24px', marginTop: '24px' }}>
        <h2 className="text-h3" style={{ marginBottom: '16px' }}>Notification Templates</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={settings.notifications.sendOrderConfirmed} onChange={(e) => setSectionValue('notifications', 'sendOrderConfirmed', e.target.checked)} />
              Send order confirmed
            </label>
            <textarea className="input-field" rows={4} style={{ borderRadius: 'var(--radius-md)', padding: '12px 16px' }} value={settings.notifications.orderConfirmedTemplate} onChange={(e) => setSectionValue('notifications', 'orderConfirmedTemplate', e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={settings.notifications.sendOutForDelivery} onChange={(e) => setSectionValue('notifications', 'sendOutForDelivery', e.target.checked)} />
              Send out-for-delivery
            </label>
            <textarea className="input-field" rows={4} style={{ borderRadius: 'var(--radius-md)', padding: '12px 16px' }} value={settings.notifications.outForDeliveryTemplate} onChange={(e) => setSectionValue('notifications', 'outForDeliveryTemplate', e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={settings.notifications.sendDelivered} onChange={(e) => setSectionValue('notifications', 'sendDelivered', e.target.checked)} />
              Send delivered
            </label>
            <textarea className="input-field" rows={4} style={{ borderRadius: 'var(--radius-md)', padding: '12px 16px' }} value={settings.notifications.deliveredTemplate} onChange={(e) => setSectionValue('notifications', 'deliveredTemplate', e.target.value)} />
          </div>
        </div>
      </Card>
    </div>
  );
}
