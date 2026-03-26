import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, Button, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl,
  CircularProgress, Snackbar, Alert, Chip, Drawer, Divider, IconButton,
  Grid, Card, CardContent, Tooltip, Pagination,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CancelIcon from '@mui/icons-material/Cancel';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import axios from 'axios';
import { formatKES } from '../utils/currency';

const ALL_STATUSES = ['PENDING','CONFIRMED','PREPARING','ASSIGNED','DRIVER_ACCEPTED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
const STATUS_COLORS = {
  PENDING: 'warning', CONFIRMED: 'info', PREPARING: 'info',
  ASSIGNED: 'primary', DRIVER_ACCEPTED: 'primary', OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success', CANCELLED: 'error',
};

function timelineLabel(order) {
  const steps = [
    { label: 'Order placed',       at: order.createdAt },
    { label: 'Driver assigned',    at: order.status === 'ASSIGNED' ? order.updatedAt : null },
    { label: 'Picked up',          at: order.pickedUpAt },
    { label: 'Delivered',          at: order.deliveredAt },
  ].filter(s => s.at);
  return steps;
}

function OrderDetailDrawer({ order, drivers, open, onClose, onAction }) {
  const [noteText, setNoteText] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [activeDialog, setActiveDialog] = useState(null); // 'cancel'|'refund'|'assign'|'note'
  const [saving, setSaving] = useState(false);

  if (!order) return null;

  const custInfo = (() => { try { return JSON.parse(order.customerInfo || '{}'); } catch { return {}; } })();

  const doAction = async (url, data, action) => {
    setSaving(true);
    try {
      await axios.post(url, data);
      setActiveDialog(null);
      onAction(action);
    } catch (e) {
      alert(e.response?.data?.error || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const info = (label, value) => value ? (
    <Box mb={1}><Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography></Box>
  ) : null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>
          {order.orderNumber || order.id.slice(-8).toUpperCase()}
        </Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      {/* Status + chips */}
      <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
        <Chip label={order.status} color={STATUS_COLORS[order.status] || 'default'} />
        {order.refundedAt && <Chip label={`Refunded KES ${order.refundAmount}`} color="warning" size="small" />}
        {order.cancellationReason && <Chip label={`Cancelled: ${order.cancellationReason}`} color="error" size="small" />}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Key info */}
      <Grid container spacing={1} mb={2}>
        <Grid item xs={6}>{info('Store', order.store?.name)}</Grid>
        <Grid item xs={6}>{info('Category', order.store?.category)}</Grid>
        <Grid item xs={6}>{info('Customer', order.customer?.name)}</Grid>
        <Grid item xs={6}>{info('Customer Phone', order.customer?.phone)}</Grid>
        <Grid item xs={6}>{info('Driver', order.driver?.name || 'Unassigned')}</Grid>
        <Grid item xs={6}>{info('Driver Phone', order.driver?.phone)}</Grid>
        <Grid item xs={6}>{info('Payment', custInfo.paymentMethod)}</Grid>
        <Grid item xs={6}>{info('Delivery Address', order.deliveryAddress)}</Grid>
        <Grid item xs={6}>{info('Order Total', formatKES(order.total))}</Grid>
        <Grid item xs={6}>{info('Delivery Fee', formatKES(order.deliveryFee))}</Grid>
        <Grid item xs={12}>{info('Placed At', order.createdAt ? new Date(order.createdAt).toLocaleString() : null)}</Grid>
        {order.pickedUpAt && <Grid item xs={6}>{info('Picked Up', new Date(order.pickedUpAt).toLocaleString())}</Grid>}
        {order.deliveredAt && <Grid item xs={6}>{info('Delivered', new Date(order.deliveredAt).toLocaleString())}</Grid>}
      </Grid>

      {/* Items */}
      {order.items?.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Items</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Product</TableCell><TableCell>Qty</TableCell><TableCell>Price</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {order.items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell>{it.product?.name || it.productId}</TableCell>
                    <TableCell>{it.quantity}</TableCell>
                    <TableCell>{formatKES(it.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Internal Notes */}
      {order.notes?.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Admin Notes</Typography>
          {order.notes.map(n => (
            <Box key={n.id} sx={{ background: '#fffde7', borderRadius: 1, p: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {n.admin?.name} · {new Date(n.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="body2">{n.text}</Typography>
            </Box>
          ))}
        </>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Admin Actions */}
      <Typography variant="subtitle2" fontWeight={700} mb={1}>Admin Actions</Typography>
      <Box display="flex" gap={1} flexWrap="wrap">
        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
          <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />}
            onClick={() => setActiveDialog('cancel')}>Cancel Order</Button>
        )}
        {!order.refundedAt && (order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
          <Button size="small" variant="outlined" color="warning" startIcon={<MoneyOffIcon />}
            onClick={() => { setRefundAmount(String(order.total)); setActiveDialog('refund'); }}>
            Issue Refund</Button>
        )}
        {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <Button size="small" variant="outlined" startIcon={<AssignmentIndIcon />}
            onClick={() => setActiveDialog('assign')}>Assign Driver</Button>
        )}
        <Button size="small" variant="outlined" startIcon={<NoteAddIcon />}
          onClick={() => setActiveDialog('note')}>Add Note</Button>
      </Box>

      {/* Cancel dialog */}
      <Dialog open={activeDialog === 'cancel'} onClose={() => setActiveDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel Order</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Cancellation Reason" value={cancelReason}
            onChange={e => setCancelReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Back</Button>
          <Button variant="contained" color="error" disabled={!cancelReason || saving}
            onClick={() => doAction(`/api/admin/orders/${order.id}/cancel`, { reason: cancelReason }, 'cancel')}>
            Confirm Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={activeDialog === 'refund'} onClose={() => setActiveDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Issue Refund</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Refund Amount (KES)" type="number" value={refundAmount}
            onChange={e => setRefundAmount(e.target.value)} sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="Refund Reason" value={refundReason}
            onChange={e => setRefundReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Back</Button>
          <Button variant="contained" color="warning" disabled={!refundAmount || !refundReason || saving}
            onClick={() => doAction(`/api/admin/orders/${order.id}/refund`, { amount: refundAmount, reason: refundReason }, 'refund')}>
            Confirm Refund</Button>
        </DialogActions>
      </Dialog>

      {/* Assign driver dialog */}
      <Dialog open={activeDialog === 'assign'} onClose={() => setActiveDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Force-Assign Driver</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Driver</InputLabel>
            <Select value={assignDriverId} onChange={e => setAssignDriverId(e.target.value)} label="Driver">
              {drivers.map(d => <MenuItem key={d.id} value={d.id}>{d.name} — {d.vehicle}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Back</Button>
          <Button variant="contained" disabled={!assignDriverId || saving}
            onClick={() => doAction(`/api/admin/orders/${order.id}/assign`, { driverId: assignDriverId }, 'assign')}>
            Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={activeDialog === 'note'} onClose={() => setActiveDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Internal Note</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label="Note" value={noteText}
            onChange={e => setNoteText(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveDialog(null)}>Back</Button>
          <Button variant="contained" disabled={!noteText.trim() || saving}
            onClick={() => doAction(`/api/admin/orders/${order.id}/notes`, { text: noteText }, 'note')}>
            Save Note</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchOrders = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 30 };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const res = await axios.get('/api/admin/orders', { params });
      setOrders(res.data.orders || []);
      setTotalPages(res.data.pages || 1);
      setTotalOrders(res.data.total || 0);
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch orders', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  const fetchDrivers = useCallback(async () => {
    try { const res = await axios.get('/api/drivers'); setDrivers(res.data); } catch {}
  }, []);

  useEffect(() => { fetchOrders(1); setPage(1); }, [search, filterStatus]); // eslint-disable-line
  useEffect(() => { fetchOrders(page); }, [page]); // eslint-disable-line
  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const openDrawer = (order) => { setSelectedOrder(order); setDrawerOpen(true); };

  const handleAction = (type) => {
    const msgs = { cancel: 'Order cancelled', refund: 'Refund issued', assign: 'Driver assigned', note: 'Note added' };
    setSnackbar({ open: true, message: msgs[type] || 'Done', severity: 'success' });
    fetchOrders(page);
    // Refresh selected order
    if (selectedOrder) {
      axios.get('/api/admin/orders', { params: { search: selectedOrder.id, limit: 1 } })
        .then(r => { if (r.data.orders?.length) setSelectedOrder(r.data.orders[0]); })
        .catch(() => {});
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Order Monitoring</Typography>
          <Typography variant="caption" color="text.secondary">{totalOrders} total orders</Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => fetchOrders(page)} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          label="Search order #, customer, store, phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} label="Status">
            <MenuItem value="">All</MenuItem>
            {ALL_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Order #</b></TableCell>
                  <TableCell><b>Date</b></TableCell>
                  <TableCell><b>Store</b></TableCell>
                  <TableCell><b>Customer</b></TableCell>
                  <TableCell><b>Driver</b></TableCell>
                  <TableCell><b>Total</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                  <TableCell><b>Flags</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No orders found</TableCell></TableRow>
                ) : orders.map(order => (
                  <TableRow key={order.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDrawer(order)}>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>
                      {order.orderNumber || order.id.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>{order.store?.name}</TableCell>
                    <TableCell>
                      <Box>{order.customer?.name}</Box>
                      <Typography variant="caption" color="text.secondary">{order.customer?.phone}</Typography>
                    </TableCell>
                    <TableCell>{order.driver?.name || <Typography variant="caption" color="text.secondary">Unassigned</Typography>}</TableCell>
                    <TableCell>{formatKES(order.total)}</TableCell>
                    <TableCell>
                      <Chip label={order.status} color={STATUS_COLORS[order.status] || 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      {order.refundedAt && <Chip label="Refunded" color="warning" size="small" sx={{ mr: 0.5 }} />}
                      {order.cancellationReason && <Chip label="Cancelled" color="error" size="small" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        </>
      )}

      {/* Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        drivers={drivers}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAction={handleAction}
      />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default Orders;