import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
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

function statusColor(status) {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCEEDED':
      return 'success';
    case 'FAILED':
    case 'CANCELLED':
      return 'error';
    case 'PROCESSING':
      return 'warning';
    default:
      return 'info';
  }
}

function Payments() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalIntents: 0, totalVolume: 0, byStatus: {}, byProvider: {} });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [busyIntentId, setBusyIntentId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

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
      const response = await apiClient.get('/api/admin/payments/intents', {
        params: {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          provider: providerFilter === 'ALL' ? undefined : providerFilter,
          search: search || undefined,
          limit: 80
        }
      });
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
      setSummary(response.data?.summary || { totalIntents: 0, totalVolume: 0, byStatus: {}, byProvider: {} });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load payment operations data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, providerFilter, search]);

  const stalePendingCount = useMemo(() => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    return items.filter((item) => (
      ['PROCESSING', 'REQUIRES_ACTION'].includes(String(item.status || '').toUpperCase())
      && new Date(item.createdAt).getTime() < cutoff
    )).length;
  }, [items]);

  const failedCount = Number(summary.byStatus?.FAILED || 0) + Number(summary.byStatus?.CANCELLED || 0);
  const successCount = Number(summary.byStatus?.SUCCEEDED || 0);

  const handleReconcile = async (intentId) => {
    try {
      setBusyIntentId(intentId);
      getAuthConfig();
      await apiClient.post(`/api/admin/payments/intents/${intentId}/reconcile`);
      showSnackbar('Payment intent reconciled');
      await fetchData();
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to reconcile payment intent', 'error');
    } finally {
      setBusyIntentId('');
    }
  };

  const handleAddNote = async (item) => {
    const note = window.prompt(`Add an internal note for payment intent ${item.id.slice(0, 8)}`)?.trim();
    if (!note) {
      return;
    }

    try {
      setBusyIntentId(item.id);
      getAuthConfig();
      const response = await apiClient.post(`/api/admin/payments/intents/${item.id}/notes`, { note });
      const updatedIntent = response.data?.intent;
      if (updatedIntent) {
        setItems((previous) => previous.map((entry) => (entry.id === item.id ? updatedIntent : entry)));
      }
      showSnackbar('Payment note added');
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to add payment note', 'error');
    } finally {
      setBusyIntentId('');
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      getAuthConfig();
      const response = await apiClient.get('/api/admin/payments/intents/export', {
        params: {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          provider: providerFilter === 'ALL' ? undefined : providerFilter,
          search: search || undefined,
          attentionOnly: true
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payment-attention-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar('Payment attention export downloaded');
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to export payment intents', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenDetail = async (intentId) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      setDetailData(null);
      getAuthConfig();
      const response = await apiClient.get(`/api/admin/payments/intents/${intentId}`);
      setDetailData(response.data || null);
    } catch (err) {
      setDetailOpen(false);
      showSnackbar(err?.response?.data?.error || 'Failed to load payment intent detail', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const detailIntent = detailData?.intent || null;
  const detailRetryHistory = Array.isArray(detailData?.retryHistory) ? detailData.retryHistory : [];
  const detailProviderEvents = Array.isArray(detailData?.providerEvents) ? detailData.providerEvents : [];

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Typography variant="h4" sx={{ mb: 1 }}>Payments</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Monitor payment intents, inspect retry chains, and reconcile stuck transactions from one operations view.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        <Card><CardContent><Typography color="text.secondary" variant="body2">Total Intents</Typography><Typography variant="h5">{summary.totalIntents || 0}</Typography></CardContent></Card>
        <Card><CardContent><Typography color="text.secondary" variant="body2">Processed Volume</Typography><Typography variant="h5">{formatKES(summary.totalVolume || 0)}</Typography></CardContent></Card>
        <Card><CardContent><Typography color="text.secondary" variant="body2">Completed Payments</Typography><Typography variant="h5">{successCount}</Typography></CardContent></Card>
        <Card><CardContent><Typography color="text.secondary" variant="body2">Needs Attention</Typography><Typography variant="h5">{failedCount + stalePendingCount}</Typography><Typography variant="caption" color="text.secondary">{failedCount} failed/cancelled · {stalePendingCount} stale pending</Typography></CardContent></Card>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel id="payment-status-filter-label">Status</InputLabel>
            <Select labelId="payment-status-filter-label" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['ALL', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].map((value) => (
                <MenuItem key={value} value={value}>{value === 'ALL' ? 'All statuses' : value.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel id="payment-provider-filter-label">Provider</InputLabel>
            <Select labelId="payment-provider-filter-label" label="Provider" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
              {['ALL', 'STRIPE', 'MPESA', 'MOCK'].map((value) => (
                <MenuItem key={value} value={value}>{value === 'ALL' ? 'All providers' : value}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Search"
            placeholder="Intent, provider ref, order, customer, store"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            sx={{ minWidth: 280, flexGrow: 1 }}
          />

          <Button variant="contained" onClick={() => setSearch(searchDraft.trim())}>Apply</Button>
          <Button variant="outlined" onClick={() => { setSearchDraft(''); setSearch(''); setStatusFilter('ALL'); setProviderFilter('ALL'); }}>Reset</Button>
          <Button variant="outlined" onClick={fetchData}>Refresh</Button>
          <Button variant="outlined" onClick={handleExport} disabled={exporting}>{exporting ? 'Exporting...' : 'Export Attention CSV'}</Button>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Created</TableCell>
                  <TableCell>Order / Customer</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Provider Ref</TableCell>
                  <TableCell>Retry Chain</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2">{new Date(item.createdAt).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.id.slice(0, 8)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{item.linkedOrderNumber || item.order?.orderNumber || 'Unlinked intent'}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">{item.customerName || item.customer?.name || 'Unknown customer'}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">{item.storeName || item.order?.store?.name || 'No store linked'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={item.provider} />
                    </TableCell>
                    <TableCell>{formatKES(Number(item.amount || 0))}</TableCell>
                    <TableCell>
                      <Chip size="small" color={statusColor(item.status)} label={String(item.status || '').replace(/_/g, ' ')} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{item.providerRef || 'Pending provider ref'}</Typography>
                    </TableCell>
                    <TableCell>
                      {item.retrySourceIntentId ? (
                        <>
                          <Typography variant="caption" display="block">Retried from {String(item.retrySourceIntentId).slice(0, 8)}</Typography>
                          <Typography variant="caption" color="text.secondary">Retries: {item.retryCount || 1}</Typography>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Original intent</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(item.adminNotes) && item.adminNotes.length > 0 ? (
                        <Stack spacing={0.5}>
                          <Typography variant="caption" fontWeight={600}>{item.adminNotes[0].authorName || 'Admin'}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.adminNotes[0].note}</Typography>
                          <Typography variant="caption" color="text.secondary">{new Date(item.adminNotes[0].createdAt).toLocaleString()}</Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">No internal notes</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenDetail(item.id)}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busyIntentId === item.id || String(item.status || '').toUpperCase() === 'SUCCEEDED'}
                          onClick={() => handleReconcile(item.id)}
                        >
                          {busyIntentId === item.id ? 'Reconciling...' : 'Reconcile'}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busyIntentId === item.id}
                          onClick={() => handleAddNote(item)}
                        >
                          Note
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No payment intents matched the current filters.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Drawer
            anchor="right"
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="h6">Payment Detail</Typography>
                <Typography variant="caption" color="text.secondary">
                  {detailIntent ? `${detailIntent.id.slice(0, 8)} · ${detailIntent.provider}` : 'Loading payment intent'}
                </Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => setDetailOpen(false)}>Close</Button>
            </Box>

            {detailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : detailIntent ? (
              <Stack spacing={2}>
                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Status</Typography><Typography variant="body2" fontWeight={700}>{detailIntent.status}</Typography></CardContent></Card>
                  <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Amount</Typography><Typography variant="body2" fontWeight={700}>{formatKES(Number(detailIntent.amount || 0))}</Typography></CardContent></Card>
                  <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Customer</Typography><Typography variant="body2" fontWeight={700}>{detailIntent.customerName || 'Unknown customer'}</Typography><Typography variant="caption" color="text.secondary">{detailIntent.customerPhone || 'No phone on file'}</Typography></CardContent></Card>
                  <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">Order</Typography><Typography variant="body2" fontWeight={700}>{detailIntent.linkedOrderNumber || 'Unlinked intent'}</Typography><Typography variant="caption" color="text.secondary">{detailIntent.storeName || 'No store linked'}</Typography></CardContent></Card>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Provider Action</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2">{detailIntent.action?.type || 'No action type'}</Typography>
                    <Typography variant="caption" color="text.secondary">{detailIntent.action?.message || 'No provider action metadata recorded.'}</Typography>
                    {detailIntent.providerRef && <Typography variant="caption" display="block" color="text.secondary">Provider ref: {detailIntent.providerRef}</Typography>}
                  </Paper>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Retry History</Typography>
                  {detailRetryHistory.length > 0 ? (
                    <Stack spacing={1}>
                      {detailRetryHistory.map((entry) => (
                        <Paper key={entry.id} variant="outlined" sx={{ p: 1.5, borderColor: entry.isSelected ? 'primary.main' : 'divider' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{entry.id.slice(0, 8)} {entry.isSelected ? '(selected)' : ''}</Typography>
                              <Typography variant="caption" color="text.secondary">{new Date(entry.createdAt).toLocaleString()}</Typography>
                            </Box>
                            <Chip size="small" color={statusColor(entry.status)} label={String(entry.status || '').replace(/_/g, ' ')} />
                          </Box>
                          <Typography variant="caption" display="block" color="text.secondary">Depth: {entry.retryDepth || 0} · Retries: {entry.retryCount || 0}</Typography>
                          <Typography variant="caption" display="block" color="text.secondary">Provider ref: {entry.providerRef || 'Pending provider ref'}</Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No retry history recorded for this intent.</Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Provider Events</Typography>
                  {detailProviderEvents.length > 0 ? (
                    <Stack spacing={1}>
                      {detailProviderEvents.map((event) => (
                        <Paper key={event.id} variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="body2" fontWeight={700}>{event.eventType}</Typography>
                          <Typography variant="caption" display="block" color="text.secondary">{event.providerEventId}</Typography>
                          <Typography variant="caption" display="block" color="text.secondary">Processed: {new Date(event.processedAt).toLocaleString()}</Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No provider events recorded yet.</Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: '#fafafa', overflowX: 'auto' }}>
                    <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(detailIntent.metadata || {}, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">Payment detail is unavailable.</Typography>
            )}
          </Drawer>
        </>
      )}
    </Box>
  );
}

export default Payments;