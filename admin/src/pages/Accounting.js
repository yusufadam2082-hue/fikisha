import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import axios from 'axios';
import { formatKES } from '../utils/currency';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fikisha-sut2.onrender.com';
const apiClient = axios.create({ baseURL: API_BASE_URL });

const DEFAULT_PLATFORM_FEE_PERCENT = 10;

function cycleKeyFromDate(value) {
  const date = value ? new Date(value) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isPayableOrder(order) {
  return order?.status !== 'CANCELLED';
}

function Accounting() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
  const [platformFeePercent, setPlatformFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);
  const [selectedCycle, setSelectedCycle] = useState('ALL');
  const [ledger, setLedger] = useState([]);
  const [fraudOverview, setFraudOverview] = useState([]);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      getAuthConfig();
      const [storesRes, ordersRes, payoutsRes, fraudRes] = await Promise.all([
        apiClient.get('/api/stores'),
        apiClient.get('/api/orders'),
        apiClient.get('/api/accounting/payouts'),
        apiClient.get('/api/ai/fraud-overview?limit=8')
      ]);
      setStores(storesRes.data || []);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setLedger(Array.isArray(payoutsRes.data) ? payoutsRes.data : []);
      setFraudOverview(Array.isArray(fraudRes?.data?.orders) ? fraudRes.data.orders : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cycleOptions = useMemo(() => {
    const keys = Array.from(new Set(orders.map((o) => cycleKeyFromDate(o?.createdAt)).filter(Boolean))).sort().reverse();
    return ['ALL', ...keys];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const payable = orders.filter(isPayableOrder);
    if (selectedCycle === 'ALL') {
      return payable;
    }
    return payable.filter((order) => cycleKeyFromDate(order.createdAt) === selectedCycle);
  }, [orders, selectedCycle]);

  const storeRows = useMemo(() => {
    const byStore = new Map();

    filteredOrders.forEach((order) => {
      const storeId = order?.store?.id || order?.storeId;
      if (!storeId) return;

      const entry = byStore.get(storeId) || {
        storeId,
        storeName: order?.store?.name || 'Unknown Store',
        orderCount: 0,
        grossRevenue: 0
      };

      entry.orderCount += 1;
      entry.grossRevenue += Number(order?.total || 0);
      byStore.set(storeId, entry);
    });

    const rows = Array.from(byStore.values()).map((row) => {
      const platformFee = (row.grossRevenue * Number(platformFeePercent || 0)) / 100;
      const merchantPayout = Math.max(0, row.grossRevenue - platformFee);

      const paidAmount = ledger
        .filter((p) => p.storeId === row.storeId && (selectedCycle === 'ALL' || p.cycleKey === selectedCycle))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const pendingPayout = Math.max(0, merchantPayout - paidAmount);

      return {
        ...row,
        platformFee,
        merchantPayout,
        paidAmount,
        pendingPayout,
        payoutStatus: pendingPayout <= 0.009 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID'
      };
    });

    return rows.sort((a, b) => b.pendingPayout - a.pendingPayout);
  }, [filteredOrders, platformFeePercent, ledger, selectedCycle]);

  const totals = useMemo(() => {
    return storeRows.reduce(
      (acc, row) => {
        acc.grossRevenue += row.grossRevenue;
        acc.platformRevenue += row.platformFee;
        acc.merchantPayouts += row.merchantPayout;
        acc.paidOut += row.paidAmount;
        acc.pending += row.pendingPayout;
        acc.orders += row.orderCount;
        return acc;
      },
      {
        grossRevenue: 0,
        platformRevenue: 0,
        merchantPayouts: 0,
        paidOut: 0,
        pending: 0,
        orders: 0
      }
    );
  }, [storeRows]);

  const payoutHistory = useMemo(() => {
    const scoped = ledger.filter((entry) => selectedCycle === 'ALL' || entry.cycleKey === selectedCycle);
    return scoped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ledger, selectedCycle]);

  const handleMarkPaid = async (row) => {
    if (row.pendingPayout <= 0) {
      return;
    }

    const cycleKey = selectedCycle === 'ALL' ? cycleKeyFromDate(new Date()) : selectedCycle;

    try {
      getAuthConfig();
      const response = await apiClient.post('/api/accounting/payouts', {
        storeId: row.storeId,
        storeName: row.storeName,
        cycleKey,
        amount: Number(row.pendingPayout.toFixed(2)),
        note: 'Settled merchant balance'
      });

      const created = response.data;
      setLedger((previous) => [created, ...previous]);
      showSnackbar(`Recorded payout for ${row.storeName}: ${formatKES(created.amount)}`);
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to record payout', 'error');
    }
  };

  const handleResetCycleLedger = async () => {
    if (!window.confirm('Reset payout records for selected cycle? This action removes recorded payout history for this cycle in the admin portal ledger.')) {
      return;
    }

    try {
      getAuthConfig();
      if (selectedCycle === 'ALL') {
        await apiClient.delete('/api/accounting/payouts');
        setLedger([]);
      } else {
        await apiClient.delete('/api/accounting/payouts', { params: { cycleKey: selectedCycle } });
        setLedger((previous) => previous.filter((entry) => entry.cycleKey !== selectedCycle));
      }
      showSnackbar('Payout ledger reset completed', 'warning');
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to reset payout ledger', 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Typography variant="h4" sx={{ mb: 1 }}>Accounting</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Track platform revenue, merchant payout obligations, and settlement history per store.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 210 }}>
            <InputLabel id="cycle-select-label">Accounting Cycle</InputLabel>
            <Select
              labelId="cycle-select-label"
              label="Accounting Cycle"
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
            >
              {cycleOptions.map((key) => (
                <MenuItem key={key} value={key}>{key === 'ALL' ? 'All Time' : key}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Platform Fee (%)"
            type="number"
            value={platformFeePercent}
            inputProps={{ min: 0, max: 100, step: 0.5 }}
            onChange={(e) => setPlatformFeePercent(Number(e.target.value || 0))}
            sx={{ width: 180 }}
          />

          <Button variant="outlined" onClick={fetchData}>Refresh</Button>
          <Button variant="outlined" color="warning" onClick={handleResetCycleLedger}>Reset Ledger</Button>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>AI Fraud Monitor</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Risk scores are based on order value, account age, and unusual ordering patterns.
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Store</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Risk Score</TableCell>
                  <TableCell>Risk Level</TableCell>
                  <TableCell>Signals</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fraudOverview.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No fraud insights available yet.</TableCell>
                  </TableRow>
                ) : (
                  fraudOverview.map((row) => (
                    <TableRow key={row.orderId}>
                      <TableCell>{row.orderId}</TableCell>
                      <TableCell>{row.storeName}</TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>{formatKES(Number(row.total || 0))}</TableCell>
                      <TableCell>{row.riskScore}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.riskLevel}
                          color={row.riskLevel === 'HIGH' ? 'error' : row.riskLevel === 'MEDIUM' ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell>{Array.isArray(row.signals) ? row.signals.join(', ') : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2, mb: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">Gross Revenue</Typography>
                <Typography variant="h6">{formatKES(totals.grossRevenue)}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">Platform Revenue</Typography>
                <Typography variant="h6">{formatKES(totals.platformRevenue)}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">Merchant Payouts (Total)</Typography>
                <Typography variant="h6">{formatKES(totals.merchantPayouts)}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">Already Paid</Typography>
                <Typography variant="h6">{formatKES(totals.paidOut)}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">Pending Merchant Payouts</Typography>
                <Typography variant="h6">{formatKES(totals.pending)}</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">Payable Orders</Typography>
                <Typography variant="h6">{totals.orders}</Typography>
              </CardContent>
            </Card>
          </Box>

          <Typography variant="h6" sx={{ mb: 1 }}>Store Payout Breakdown</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Store</TableCell>
                  <TableCell>Orders</TableCell>
                  <TableCell>Gross Revenue</TableCell>
                  <TableCell>Platform Fee</TableCell>
                  <TableCell>Merchant Payout</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Pending</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {storeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>No payable order data found for selected cycle.</TableCell>
                  </TableRow>
                ) : (
                  storeRows.map((row) => (
                    <TableRow key={row.storeId}>
                      <TableCell>{row.storeName}</TableCell>
                      <TableCell>{row.orderCount}</TableCell>
                      <TableCell>{formatKES(row.grossRevenue)}</TableCell>
                      <TableCell>{formatKES(row.platformFee)}</TableCell>
                      <TableCell>{formatKES(row.merchantPayout)}</TableCell>
                      <TableCell>{formatKES(row.paidAmount)}</TableCell>
                      <TableCell>{formatKES(row.pendingPayout)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.payoutStatus}
                          color={row.payoutStatus === 'PAID' ? 'success' : row.payoutStatus === 'PARTIAL' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={row.pendingPayout <= 0}
                          onClick={() => handleMarkPaid(row)}
                        >
                          Mark Paid
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 1 }}>Payout Ledger</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Cycle</TableCell>
                  <TableCell>Store</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Note</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payoutHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No payout records yet.</TableCell>
                  </TableRow>
                ) : (
                  payoutHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{entry.cycleKey}</TableCell>
                      <TableCell>{entry.storeName}</TableCell>
                      <TableCell>{formatKES(entry.amount)}</TableCell>
                      <TableCell>{entry.note || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

export default Accounting;
