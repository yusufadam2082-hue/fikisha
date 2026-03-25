import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

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
  const [settings, setSettings] = useState<AdminSettingsState>(defaultSettings);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved);
      setSettings({
        ...defaultSettings,
        ...parsed,
        general: { ...defaultSettings.general, ...(parsed.general || {}) },
        orders: { ...defaultSettings.orders, ...(parsed.orders || {}) },
        delivery: { ...defaultSettings.delivery, ...(parsed.delivery || {}) },
        security: { ...defaultSettings.security, ...(parsed.security || {}) },
        notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) }
      });
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
    }
  }, []);

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

  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setMessage('Settings saved locally.');
      setTimeout(() => setMessage(''), 2500);
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage('Failed to save settings.');
      setTimeout(() => setMessage(''), 2500);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setMessage('Settings reset. Click Save to persist.');
    setTimeout(() => setMessage(''), 2500);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-h1">Platform Settings</h1>
          <p className="text-muted">Frontend-only admin settings for this browser.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={handleReset}>Reset</Button>
          <Button onClick={handleSave}>Save</Button>
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
