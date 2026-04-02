import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getAuthHeaders } from '../../utils/authStorage';
import { apiUrl } from '../../utils/apiUrl';

export function MerchantSettings() {
  const { user } = useAuth();
  const [pausedOrders, setPausedOrders] = useState(false);
  const [busyMode, setBusyMode] = useState(false);
  const [prepDelayMinutes, setPrepDelayMinutes] = useState('0');
  const [message, setMessage] = useState('');

  const saveSettings = async () => {
    if (!user?.storeId) {
      setMessage('Store not found for this merchant account.');
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/stores/${user.storeId}`), {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          pausedOrders,
          busyMode,
          prepDelayMinutes: Number(prepDelayMinutes || 0),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings (${response.status})`);
      }

      setMessage('Settings saved successfully.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Settings</h1>

      <Card style={{ padding: '16px', maxWidth: '720px' }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" checked={pausedOrders} onChange={(e) => setPausedOrders(e.target.checked)} />
            Pause incoming orders
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" checked={busyMode} onChange={(e) => setBusyMode(e.target.checked)} />
            Enable busy mode
          </label>

          <label>
            <span className="text-sm text-muted">Preparation delay in minutes</span>
            <input
              className="input-field"
              type="number"
              min="0"
              value={prepDelayMinutes}
              onChange={(e) => setPrepDelayMinutes(e.target.value)}
            />
          </label>

          <div>
            <Button onClick={saveSettings}>Save Settings</Button>
          </div>

          {message && <p className="text-sm" style={{ color: message.includes('successfully') ? 'var(--success, #16a34a)' : 'var(--error)' }}>{message}</p>}
        </div>
      </Card>
    </div>
  );
}
