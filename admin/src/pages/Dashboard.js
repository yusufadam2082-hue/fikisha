import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  Chip, Button, Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import StoreIcon from '@mui/icons-material/Store';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';

const ORDER_STATUSES = [
  'PENDING','CONFIRMED','PREPARING','ASSIGNED',
  'DRIVER_ACCEPTED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED',
];
const STATUS_COLORS = {
  PENDING: 'warning', CONFIRMED: 'info', PREPARING: 'info',
  ASSIGNED: 'primary', DRIVER_ACCEPTED: 'primary', OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success', CANCELLED: 'error',
};

function KpiCard({ title, value, subtitle, icon, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
            <Typography variant="h4" fontWeight={700} color={color || 'primary.main'}>{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          <Box sx={{ color: color || 'primary.main', opacity: 0.7 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function StatusBar({ status, count, total }) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
  return (
    <Box display="flex" alignItems="center" gap={1} mb={1}>
      <Chip label={status} color={STATUS_COLORS[status] || 'default'} size="small"
        sx={{ minWidth: 180, fontWeight: 600, justifyContent: 'flex-start' }} />
      <Box flex={1} sx={{ background: '#f0f0f0', borderRadius: 4, height: 10 }}>
        <Box sx={{ width: `${pct}%`, bgcolor: 'primary.main', borderRadius: 4, height: 10,
          minWidth: count > 0 ? 4 : 0, transition: 'width 0.6s ease' }} />
      </Box>
      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 40, textAlign: 'right' }}>{count}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>{pct}%</Typography>
    </Box>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/admin/dashboard');
      setData(res.data);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)    return `KES ${(n / 1_000).toFixed(1)}K`;
    return `KES ${Number(n).toLocaleString()}`;
  };
  const fmtNum = (n) => (n === undefined || n === null) ? '—' : Number(n).toLocaleString();

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={48} />
      </Box>
    );
  }

  const { orders = {}, revenue = {}, rates = {}, operations = {} } = data || {};
  const totalOrders = orders.total || 0;
  const statusMap = orders.byStatus || {};

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Command Center</Typography>
          {lastRefreshed && (
            <Typography variant="caption" color="text.secondary">
              Last refreshed: {lastRefreshed.toLocaleTimeString()} · Auto-refreshes every 60s
            </Typography>
          )}
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={fetchDashboard} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI Cards Row 1 */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Total Orders (All Time)" value={fmtNum(totalOrders)}
            subtitle={`${fmtNum(orders.today)} today · ${fmtNum(orders.week)} this week`}
            icon={<ShoppingCartIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Gross GMV (Delivered)" value={fmt(revenue.gmv)}
            subtitle={`Delivery fees: ${fmt(revenue.deliveryFeeRevenue)}`}
            icon={<MonetizationOnIcon sx={{ fontSize: 40 }} />} color="success.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Completion Rate" value={`${rates.completionRate || 0}%`}
            subtitle={`Cancellation rate: ${rates.cancellationRate || 0}%`}
            icon={<CheckCircleIcon sx={{ fontSize: 40 }} />}
            color={(rates.completionRate || 0) >= 80 ? 'success.main' : 'warning.main'} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Refund Volume" value={fmt(revenue.refundVolume)}
            subtitle={`${fmtNum(rates.refundCount)} refunded orders`}
            icon={<CancelIcon sx={{ fontSize: 40 }} />} color="error.main" />
        </Grid>
      </Grid>

      {/* KPI Cards Row 2 */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Active Customers" value={fmtNum(operations.totalCustomers)}
            subtitle="Non-banned accounts"
            icon={<PeopleIcon sx={{ fontSize: 40 }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Available Drivers" value={fmtNum(operations.activeDrivers)}
            subtitle="Currently available"
            icon={<DirectionsCarIcon sx={{ fontSize: 40 }} />} color="warning.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Open Stores"
            value={`${fmtNum(operations.activeStores)} / ${fmtNum(operations.totalStores)}`}
            subtitle="Active & open right now"
            icon={<StoreIcon sx={{ fontSize: 40 }} />} color="secondary.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Avg. Delivery Time"
            value={operations.avgDeliveryMins ? `${operations.avgDeliveryMins} min` : '—'}
            subtitle="Placed → delivered (all time)"
            icon={<TrendingUpIcon sx={{ fontSize: 40 }} />} color="info.main" />
        </Grid>
      </Grid>

      {/* Orders by Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>Orders by Status</Typography>
          {ORDER_STATUSES.map(s => (
            <StatusBar key={s} status={s} count={statusMap[s] || 0} total={totalOrders} />
          ))}
        </CardContent>
      </Card>

      {/* Volume breakdown */}
      <Grid container spacing={2}>
        {[
          { label: 'Today', value: fmtNum(orders.today), color: 'primary.main' },
          { label: 'This Week', value: fmtNum(orders.week), color: 'info.main' },
          { label: 'This Month', value: fmtNum(orders.month), color: 'success.main' },
        ].map(({ label, value, color }) => (
          <Grid item xs={12} md={4} key={label}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700}>Orders — {label}</Typography>
                <Typography variant="h3" fontWeight={700} color={color}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default Dashboard;