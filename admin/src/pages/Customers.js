import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Divider,
  Grid,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import GroupIcon from '@mui/icons-material/Group';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axios from 'axios';
import { formatKES } from '../utils/currency';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fikisha-sut2.onrender.com';
const apiClient = axios.create({ baseURL: API_BASE_URL });

// Sync the auth token before every request so it always uses the latest value.
apiClient.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

const STATUS_OPTIONS = [
  { value: 'all',    label: 'All customers'  },
  { value: 'active', label: 'Active only'    },
  { value: 'banned', label: 'Banned only'    },
];

const ORDER_COLS = [
  { id: 'createdAt', label: 'Date' },
  { id: 'name',      label: 'Name' },
  { id: 'email',     label: 'Email' },
  { id: 'orders',    label: 'Orders' },
  { id: 'spend',     label: 'Total Spend' },
];

function StatCard({ icon, label, value, color }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function OrderHistoryTable({ orders, loading }) {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>;
  if (!orders.length) return <Typography color="text.secondary" sx={{ p: 2 }}>No orders yet.</Typography>;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell><b>Date</b></TableCell>
            <TableCell><b>Store</b></TableCell>
            <TableCell><b>Items</b></TableCell>
            <TableCell><b>Total</b></TableCell>
            <TableCell><b>Status</b></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map(o => (
            <TableRow key={o.id} hover>
              <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>{o.store?.name || '—'}</TableCell>
              <TableCell>{(o.items || []).map(i => i.product?.name || i.name).filter(Boolean).join(', ') || '—'}</TableCell>
              <TableCell>{formatKES(Number(o.total))}</TableCell>
              <TableCell>
                <Chip
                  label={o.status}
                  size="small"
                  color={
                    o.status === 'DELIVERED'  ? 'success' :
                    o.status === 'CANCELLED'  ? 'error'   :
                    o.status === 'PENDING'    ? 'default' : 'primary'
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Customers() {
  const [customers, setCustomers]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy]           = useState('createdAt');
  const [sortDir, setSortDir]         = useState('desc');

  // Detail / edit state
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailOrders, setDetailOrders]     = useState([]);
  const [detailOrdersLoading, setDetailOrdersLoading] = useState(false);
  const [detailOpen, setDetailOpen]         = useState(false);

  // Edit form state
  const [editOpen, setEditOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName]   = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState('');

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteOpen, setDeleteOpen]     = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/customers');
      setCustomers(res.data);
    } catch {
      notify('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => !c.banned).length;
  const bannedCustomers = customers.filter(c => c.banned).length;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = customers.filter(c => new Date(c.createdAt) > oneWeekAgo).length;
  const totalRevenue = customers.reduce((s, c) => s + (c.totalSpend || 0), 0);

  // ── Filtering + sorting ─────────────────────────────────────────────────
  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q);
      const matchesStatus =
        statusFilter === 'all'    ? true :
        statusFilter === 'banned' ? c.banned :
                                    !c.banned;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'name':   av = a.name || ''; bv = b.name || ''; break;
        case 'email':  av = a.email || ''; bv = b.email || ''; break;
        case 'orders': av = a.orderCount; bv = b.orderCount; break;
        case 'spend':  av = a.totalSpend; bv = b.totalSpend; break;
        default:       av = new Date(a.createdAt); bv = new Date(b.createdAt);
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortIndicator = (col) => sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  // ── Actions ──────────────────────────────────────────────────────────────
  const openDetail = async (customer) => {
    setDetailCustomer(customer);
    setDetailOpen(true);
    setDetailOrders([]);
    setDetailOrdersLoading(true);
    try {
      const res = await apiClient.get(`/api/customers/${customer.id}/orders`);
      setDetailOrders(res.data);
    } catch {
      notify('Failed to load order history', 'error');
    } finally {
      setDetailOrdersLoading(false);
    }
  };

  const handleToggleBan = async (customer) => {
    const verb = customer.banned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${verb} ${customer.name || customer.username}?`)) return;
    try {
      const res = await apiClient.patch(`/api/customers/${customer.id}/ban`);
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, banned: res.data.banned } : c));
      if (detailCustomer?.id === customer.id) setDetailCustomer(d => ({ ...d, banned: res.data.banned }));
      notify(`Customer ${res.data.banned ? 'banned' : 'unbanned'} successfully`);
    } catch {
      notify('Failed to update ban status', 'error');
    }
  };

  const openEdit = (customer) => {
    setEditTarget(customer);
    setEditName(customer.name || '');
    setEditEmail(customer.email || '');
    setEditPhone(customer.phone || '');
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { setEditError('Name is required'); return; }
    try {
      const res = await apiClient.patch(`/api/customers/${editTarget.id}`, {
        name:  editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      });
      setCustomers(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...res.data } : c));
      if (detailCustomer?.id === editTarget.id) setDetailCustomer(d => ({ ...d, ...res.data }));
      notify('Customer updated successfully');
      setEditOpen(false);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to save changes');
    }
  };

  const openDelete = (customer) => { setDeleteTarget(customer); setDeleteOpen(true); };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/api/users/${deleteTarget.id}`);
      setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
      if (detailCustomer?.id === deleteTarget.id) setDetailOpen(false);
      notify('Customer deleted');
      setDeleteOpen(false);
    } catch {
      notify('Failed to delete customer', 'error');
    }
  };

  // ── CSV export ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['ID', 'Username', 'Name', 'Email', 'Phone', 'Banned', 'Orders', 'Total Spend', 'Last Order', 'Joined'],
      ...filtered.map(c => [
        c.id,
        c.username,
        c.name,
        c.email || '',
        c.phone || '',
        c.banned ? 'Yes' : 'No',
        c.orderCount,
        c.totalSpend.toFixed(2),
        c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '',
        new Date(c.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `fikisha-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Snackbar ── */}
      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Customer Management</Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} disabled={!filtered.length}>
          Export CSV
        </Button>
      </Box>

      {/* ── Stat Cards ── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <StatCard icon={<GroupIcon fontSize="large" />}       label="Total Customers" value={totalCustomers}          color="primary.main" />
        <StatCard icon={<CheckCircleIcon fontSize="large" />} label="Active"          value={activeCustomers}         color="success.main" />
        <StatCard icon={<PersonOffIcon fontSize="large" />}   label="Banned"          value={bannedCustomers}         color="error.main"   />
        <StatCard icon={<ShoppingCartIcon fontSize="large" />}label="New This Week"   value={newThisWeek}             color="warning.main" />
        <StatCard icon={<TrendingUpIcon fontSize="large" />}  label="Total Revenue"   value={formatKES(totalRevenue)} color="info.main"    />
      </Box>

      {/* ── Filters ── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          placeholder="Search name, username, email, phone…"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 220 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* ── Table ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>No customers found.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                {ORDER_COLS.map(col => (
                  <TableCell key={col.id} onClick={() => toggleSort(col.id)} sx={{ cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>
                    {col.label}{sortIndicator(col.id)}
                  </TableCell>
                ))}
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Last Order</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(customer => (
                <TableRow key={customer.id} hover sx={{ opacity: customer.banned ? 0.65 : 1 }}>
                  <TableCell>
                    <Tooltip title={new Date(customer.createdAt).toLocaleDateString()} arrow>
                      <span>{new Date(customer.createdAt).toLocaleDateString()}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{customer.name || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">@{customer.username}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{customer.email || '—'}</TableCell>
                  <TableCell>{customer.orderCount}</TableCell>
                  <TableCell>{formatKES(customer.totalSpend)}</TableCell>
                  <TableCell>{customer.phone || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={customer.banned ? 'Banned' : 'Active'}
                      color={customer.banned ? 'error' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View details & orders" arrow>
                        <IconButton size="small" color="primary" onClick={() => openDetail(customer)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit profile" arrow>
                        <IconButton size="small" color="default" onClick={() => openEdit(customer)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={customer.banned ? 'Unban customer' : 'Ban customer'} arrow>
                        <IconButton size="small" color={customer.banned ? 'success' : 'warning'} onClick={() => handleToggleBan(customer)}>
                          {customer.banned ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete customer" arrow>
                        <IconButton size="small" color="error" onClick={() => openDelete(customer)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Customer Detail Dialog ── */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Customer Profile</span>
          <IconButton size="small" onClick={() => setDetailOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailCustomer && (
            <Grid container spacing={3}>
              {/* Left: profile info */}
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{
                    width: 72, height: 72, borderRadius: '50%',
                    bgcolor: 'primary.main', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', fontWeight: 700,
                  }}>
                    {(detailCustomer.name || detailCustomer.username || 'C').charAt(0).toUpperCase()}
                  </Box>
                  <Typography variant="h6" fontWeight={700}>{detailCustomer.name || '—'}</Typography>
                  <Typography variant="body2" color="text.secondary">@{detailCustomer.username}</Typography>

                  <Divider />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">EMAIL</Typography>
                    <Typography variant="body2">{detailCustomer.email || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">PHONE</Typography>
                    <Typography variant="body2">{detailCustomer.phone || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">JOINED</Typography>
                    <Typography variant="body2">{new Date(detailCustomer.createdAt).toLocaleDateString()}</Typography>
                    <Typography variant="caption" color="text.secondary">STATUS</Typography>
                    <Chip label={detailCustomer.banned ? 'Banned' : 'Active'} color={detailCustomer.banned ? 'error' : 'success'} size="small" sx={{ alignSelf: 'flex-start' }} />
                  </Box>

                  <Divider />

                  {/* Inline stats */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">TOTAL ORDERS</Typography>
                    <Typography variant="h6" fontWeight={700}>{detailCustomer.orderCount}</Typography>
                    <Typography variant="caption" color="text.secondary">TOTAL SPEND</Typography>
                    <Typography variant="h6" fontWeight={700} color="primary">{formatKES(detailCustomer.totalSpend)}</Typography>
                    <Typography variant="caption" color="text.secondary">LAST ORDER</Typography>
                    <Typography variant="body2">{detailCustomer.lastOrderAt ? new Date(detailCustomer.lastOrderAt).toLocaleDateString() : '—'}</Typography>
                  </Box>

                  <Divider />

                  {/* Quick actions */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => { setDetailOpen(false); openEdit(detailCustomer); }}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color={detailCustomer.banned ? 'success' : 'warning'}
                      startIcon={detailCustomer.banned ? <CheckCircleIcon /> : <BlockIcon />}
                      onClick={() => handleToggleBan(detailCustomer)}
                    >
                      {detailCustomer.banned ? 'Unban' : 'Ban'}
                    </Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => { setDetailOpen(false); openDelete(detailCustomer); }}>
                      Delete
                    </Button>
                  </Box>
                </Box>
              </Grid>

              {/* Right: order history */}
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Order History</Typography>
                <OrderHistoryTable orders={detailOrders} loading={detailOrdersLoading} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Full Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            fullWidth
            required
            error={!!editError && !editName.trim()}
          />
          <TextField
            label="Email"
            type="email"
            value={editEmail}
            onChange={e => setEditEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Phone"
            value={editPhone}
            onChange={e => setEditPhone(e.target.value)}
            fullWidth
          />
          {editError && <Typography color="error" variant="caption">{editError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Customer</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete <strong>{deleteTarget?.name || deleteTarget?.username}</strong>?
            This will also remove all their orders and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Customers;
