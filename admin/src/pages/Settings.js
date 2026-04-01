import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
  Divider,
  Chip,
  CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import apiClient, { resolvedApiBaseUrl } from '../utils/apiClient';

const STORAGE_KEY = 'fikisha_admin_settings';

const defaultSettings = {
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

function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [isSaving, setIsSaving] = useState(false);
  const [healthStatus, setHealthStatus] = useState({
    status: 'checking',
    isOnline: false,
    lastChecked: null,
    error: null,
    responseTime: null
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await apiClient.get('/api/admin/settings');
        const parsed = res.data;
        if (parsed && Object.keys(parsed).length > 0) {
          setSettings({
            ...defaultSettings,
            ...parsed,
            general: { ...defaultSettings.general, ...(parsed.general || {}) },
            orders: { ...defaultSettings.orders, ...(parsed.orders || {}) },
            delivery: { ...defaultSettings.delivery, ...(parsed.delivery || {}) },
            security: { ...defaultSettings.security, ...(parsed.security || {}) },
            notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) }
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) return;
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
        } catch (inner) {
          console.error('Failed to load admin settings', inner);
        }
      }
    };
    loadSettings();
  }, []);

  // Fetch backend health status
  const fetchHealthStatus = async () => {
    const startTime = performance.now();
    try {
      const response = await apiClient.get('/health', { timeout: 5000 });
      const responseTime = Math.round(performance.now() - startTime);
      setHealthStatus({
        status: 'online',
        isOnline: true,
        lastChecked: new Date(),
        error: null,
        responseTime
      });
      console.info('[Fikisha Admin] Backend health check passed', {
        responseTime,
        timestamp: new Date().toISOString(),
        apiBaseUrl: resolvedApiBaseUrl
      });
    } catch (error) {
      setHealthStatus({
        status: 'offline',
        isOnline: false,
        lastChecked: new Date(),
        error: error.message || 'Connection failed',
        responseTime: null
      });
      console.warn('[Fikisha Admin] Backend health check failed', {
        error: error.message,
        timestamp: new Date().toISOString(),
        apiBaseUrl: resolvedApiBaseUrl
      });
    }
  };

  useEffect(() => {
    // Initial check
    fetchHealthStatus();
    // Recheck every 30 seconds
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateSection = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.post('/api/admin/settings', settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSnackbarMessage('Settings saved to database successfully.');
      setSnackbarSeverity('success');
    } catch (error) {
      setSnackbarMessage(error?.response?.data?.error || 'Failed to save settings to database.');
      setSnackbarSeverity('error');
    } finally {
      setIsSaving(false);
      setSnackbarOpen(true);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setSnackbarMessage('Settings reset to defaults. Click Save to persist.');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Platform Settings</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="inherit" startIcon={<RestartAltIcon />} onClick={handleReset}>
            Reset
          </Button>
          <Button variant="contained" color="primary" startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Health & Environment Panel */}
        <Grid item xs={12}>
          <Card sx={{ background: healthStatus.isOnline ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)' : 'linear-gradient(135deg, #ffebee 0%, #fff3e0 100%)', border: `2px solid ${healthStatus.isOnline ? '#4caf50' : '#f44336'}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HealthAndSafetyIcon sx={{ color: healthStatus.isOnline ? '#4caf50' : '#f44336', fontSize: 28 }} />
                  <Typography variant="h6">System Health & Environment</Typography>
                </Box>
                <Chip 
                  icon={healthStatus.status === 'checking' ? undefined : (healthStatus.isOnline ? <CheckCircleIcon /> : <ErrorIcon />)}
                  label={healthStatus.status === 'checking' ? 'Checking...' : (healthStatus.isOnline ? 'Online' : 'Offline')}
                  color={healthStatus.isOnline ? 'success' : 'error'}
                  variant="outlined"
                />
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">API Base URL</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}>
                      {resolvedApiBaseUrl || '(same-origin)'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">Response Time</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {healthStatus.status === 'checking' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CircularProgress size={14} /> Checking...
                        </Box>
                      ) : (
                        healthStatus.responseTime ? `${healthStatus.responseTime}ms` : 'N/A'
                      )}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">Last Checked</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {healthStatus.lastChecked ? healthStatus.lastChecked.toLocaleTimeString() : 'Never'}
                    </Typography>
                  </Box>
                </Grid>
                {healthStatus.error && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 1.5, bgcolor: 'rgba(244,67,54,0.1)', borderRadius: 1, border: '1px solid #f44336' }}>
                      <Typography variant="caption" color="error">Error</Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, color: '#d32f2f' }}>
                        {healthStatus.error}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
              
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={fetchHealthStatus}
                  disabled={healthStatus.status === 'checking'}
                >
                  {healthStatus.status === 'checking' ? 'Checking...' : 'Check Now'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>General</Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField
                label="Platform Name"
                fullWidth
                margin="normal"
                value={settings.general.platformName}
                onChange={(e) => updateSection('general', 'platformName', e.target.value)}
              />
              <TextField
                label="Support Email"
                type="email"
                fullWidth
                margin="normal"
                value={settings.general.supportEmail}
                onChange={(e) => updateSection('general', 'supportEmail', e.target.value)}
              />
              <TextField
                label="Support Phone"
                fullWidth
                margin="normal"
                value={settings.general.supportPhone}
                onChange={(e) => updateSection('general', 'supportPhone', e.target.value)}
              />
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Currency"
                    fullWidth
                    value={settings.general.currency}
                    onChange={(e) => updateSection('general', 'currency', e.target.value.toUpperCase())}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Timezone"
                    fullWidth
                    value={settings.general.timezone}
                    onChange={(e) => updateSection('general', 'timezone', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Order Workflow</Typography>
              <Divider sx={{ mb: 2 }} />
              <FormControl fullWidth margin="normal">
                <InputLabel id="default-status-label">Default Order Status</InputLabel>
                <Select
                  labelId="default-status-label"
                  label="Default Order Status"
                  value={settings.orders.defaultStatus}
                  onChange={(e) => updateSection('orders', 'defaultStatus', e.target.value)}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="preparing">Preparing</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Auto-cancel after (minutes)"
                type="number"
                fullWidth
                margin="normal"
                value={settings.orders.autoCancelMinutes}
                onChange={(e) => updateSection('orders', 'autoCancelMinutes', Number(e.target.value || 0))}
              />
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={settings.orders.allowCustomerCancellation}
                    onChange={(e) => updateSection('orders', 'allowCustomerCancellation', e.target.checked)}
                  />
                }
                label="Allow customer cancellation"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Delivery Rules</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Base Fee"
                    type="number"
                    fullWidth
                    value={settings.delivery.baseFee}
                    onChange={(e) => updateSection('delivery', 'baseFee', Number(e.target.value || 0))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Free Delivery Threshold"
                    type="number"
                    fullWidth
                    value={settings.delivery.freeDeliveryThreshold}
                    onChange={(e) => updateSection('delivery', 'freeDeliveryThreshold', Number(e.target.value || 0))}
                  />
                </Grid>
              </Grid>
              <FormControlLabel
                sx={{ mt: 2 }}
                control={
                  <Switch
                    checked={settings.delivery.surgeEnabled}
                    onChange={(e) => updateSection('delivery', 'surgeEnabled', e.target.checked)}
                  />
                }
                label="Enable surge pricing"
              />
              <TextField
                label="Surge Multiplier"
                type="number"
                fullWidth
                margin="normal"
                value={settings.delivery.surgeMultiplier}
                onChange={(e) => updateSection('delivery', 'surgeMultiplier', Number(e.target.value || 1))}
                disabled={!settings.delivery.surgeEnabled}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Security</Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField
                label="Session Timeout (minutes)"
                type="number"
                fullWidth
                margin="normal"
                value={settings.security.sessionTimeoutMinutes}
                onChange={(e) => updateSection('security', 'sessionTimeoutMinutes', Number(e.target.value || 0))}
              />
              <TextField
                label="Minimum Password Length"
                type="number"
                fullWidth
                margin="normal"
                value={settings.security.passwordMinLength}
                onChange={(e) => updateSection('security', 'passwordMinLength', Number(e.target.value || 0))}
              />
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={settings.security.require2FAForAdmins}
                    onChange={(e) => updateSection('security', 'require2FAForAdmins', e.target.checked)}
                  />
                }
                label="Require 2FA for admins"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notification Templates</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.sendOrderConfirmed}
                        onChange={(e) => updateSection('notifications', 'sendOrderConfirmed', e.target.checked)}
                      />
                    }
                    label="Send order confirmed"
                  />
                  <TextField
                    label="Order Confirmed Template"
                    multiline
                    minRows={3}
                    fullWidth
                    value={settings.notifications.orderConfirmedTemplate}
                    onChange={(e) => updateSection('notifications', 'orderConfirmedTemplate', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.sendOutForDelivery}
                        onChange={(e) => updateSection('notifications', 'sendOutForDelivery', e.target.checked)}
                      />
                    }
                    label="Send out-for-delivery"
                  />
                  <TextField
                    label="Out for Delivery Template"
                    multiline
                    minRows={3}
                    fullWidth
                    value={settings.notifications.outForDeliveryTemplate}
                    onChange={(e) => updateSection('notifications', 'outForDeliveryTemplate', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.sendDelivered}
                        onChange={(e) => updateSection('notifications', 'sendDelivered', e.target.checked)}
                      />
                    }
                    label="Send delivered"
                  />
                  <TextField
                    label="Delivered Template"
                    multiline
                    minRows={3}
                    fullWidth
                    value={settings.notifications.deliveredTemplate}
                    onChange={(e) => updateSection('notifications', 'deliveredTemplate', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Settings;
