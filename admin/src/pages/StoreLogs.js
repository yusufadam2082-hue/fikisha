import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import axios from 'axios';
import { formatKES } from '../utils/currency';
import { getStoreSecurityEvents } from '../utils/storeSecurityLog';

// Use backend URL directly to avoid proxy issues
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fikisha-sut2.onrender.com';
const apiClient = axios.create({ baseURL: API_BASE_URL });

function parsePaymentMethod(customerInfo) {
  if (!customerInfo) {
    return 'Unknown';
  }

  if (typeof customerInfo === 'string') {
    try {
      const parsed = JSON.parse(customerInfo);
      return parsed?.paymentMethod || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  return customerInfo?.paymentMethod || 'Unknown';
}

function StoreLogs() {
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState('');
  const [logsData, setLogsData] = useState(null);
  const [usingFallbackLogs, setUsingFallbackLogs] = useState(false);

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return {};
  };

  const fetchStores = async () => {
    try {
      setLoadingStores(true);
      getAuthConfig();
      const response = await apiClient.get('/api/stores');
      setStores(response.data || []);
      if ((response.data || []).length > 0) {
        setSelectedStoreId(response.data[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load stores');
    } finally {
      setLoadingStores(false);
    }
  };

  const generateLogs = async () => {
    if (!selectedStoreId) {
      return;
    }

    try {
      setLoadingLogs(true);
      setError('');
      setUsingFallbackLogs(false);
      getAuthConfig();
      const response = await apiClient.get(`/api/stores/${selectedStoreId}/logs`);
      setLogsData(response.data);
    } catch (err) {
      try {
        const ordersResponse = await apiClient.get('/api/orders');
        const storeOrders = (ordersResponse.data || []).filter((order) => order?.store?.id === selectedStoreId || order?.storeId === selectedStoreId);
        const events = getStoreSecurityEvents(selectedStoreId);

        const orderLogs = storeOrders.map((order) => ({
          orderId: order.id,
          status: order.status,
          amount: Number(order.total || 0),
          paymentMethod: parsePaymentMethod(order.customerInfo),
          driverId: order.driver?.id || order.driverId || null,
          driverName: order.driver?.name || 'Unassigned',
          orderedAt: order.createdAt,
          lastUpdatedAt: order.updatedAt
        }));

        setLogsData({
          store: {
            id: selectedStoreId,
            name: selectedStore?.name || 'Selected Store'
          },
          generatedAt: new Date().toISOString(),
          openingClosingLogs: events.filter((entry) => entry.type === 'STORE_OPENED' || entry.type === 'STORE_CLOSED'),
          credentialLogs: events.filter((entry) => entry.type === 'STORE_CREATED' || entry.type === 'MERCHANT_CREDENTIALS_UPDATED'),
          orderLogs,
          securityLogs: events
        });
        setUsingFallbackLogs(true);
        setError('');
      } catch (fallbackError) {
        setError(fallbackError?.response?.data?.error || err?.response?.data?.error || 'Failed to generate store logs');
        setLogsData(null);
      }
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const selectedStore = useMemo(() => stores.find((store) => store.id === selectedStoreId), [stores, selectedStoreId]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Store Security Logs</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Generate logs for orders, assigned drivers, payment details, and store opening/closing events.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        {loadingStores ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 300 }}>
              <InputLabel id="store-log-select-label">Store</InputLabel>
              <Select
                labelId="store-log-select-label"
                value={selectedStoreId}
                label="Store"
                onChange={(e) => setSelectedStoreId(e.target.value)}
              >
                {stores.map((store) => (
                  <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={generateLogs} disabled={!selectedStoreId || loadingLogs}>
              {loadingLogs ? 'Generating...' : 'Generate Logs'}
            </Button>
          </Box>
        )}
      </Paper>

      {loadingLogs && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {logsData && (
        <Box>
          {usingFallbackLogs && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Backend log endpoint unavailable. Showing logs generated from orders API and local admin events.
            </Alert>
          )}
          <Alert severity="info" sx={{ mb: 2 }}>
            Report generated for {selectedStore?.name || logsData.store?.name} at {new Date(logsData.generatedAt).toLocaleString()}.
          </Alert>

          <Typography variant="h6" sx={{ mb: 1 }}>Opening / Closing History</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Event</TableCell>
                  <TableCell>Performed By</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(logsData.openingClosingLogs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No opening/closing events recorded yet.</TableCell>
                  </TableRow>
                ) : (
                  logsData.openingClosingLogs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.type === 'STORE_OPENED' ? 'Store Opened' : 'Store Closed'}</TableCell>
                      <TableCell>{entry.actorRole || 'System'}</TableCell>
                      <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 1 }}>Merchant Credential Events</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Event</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(logsData.credentialLogs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No credential events recorded yet.</TableCell>
                  </TableRow>
                ) : (
                  logsData.credentialLogs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.type}</TableCell>
                      <TableCell>{entry.message}</TableCell>
                      <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 1 }}>Order Security Log</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Driver</TableCell>
                  <TableCell>Ordered At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(logsData.orderLogs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No orders found for this store.</TableCell>
                  </TableRow>
                ) : (
                  logsData.orderLogs.map((entry) => (
                    <TableRow key={entry.orderId}>
                      <TableCell>{entry.orderId}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell>{formatKES(entry.amount)}</TableCell>
                      <TableCell>{entry.paymentMethod}</TableCell>
                      <TableCell>{entry.driverName}</TableCell>
                      <TableCell>{new Date(entry.orderedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

export default StoreLogs;
