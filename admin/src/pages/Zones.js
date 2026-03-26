import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, OutlinedInput,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { formatKES } from '../utils/currency';

const AUDIENCE_ITEM_HEIGHT = 36;

const initialForm = {
  id: null,
  name: '',
  description: '',
  isActive: true,
  priority: 100,
  minOrderValue: '',
  baseDeliveryFee: 0,
  perKmFee: '',
  maxRadiusKm: '',
  estimatedMinMinutes: '',
  estimatedMaxMinutes: '',
  storeIds: [],
};

function ZoneDialog({ open, onClose, onSave, stores, value, saving }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!value) {
      setForm(initialForm);
      return;
    }
    setForm({
      id: value.id,
      name: value.name || '',
      description: value.description || '',
      isActive: !!value.isActive,
      priority: value.priority ?? 100,
      minOrderValue: value.minOrderValue ?? '',
      baseDeliveryFee: value.baseDeliveryFee ?? 0,
      perKmFee: value.perKmFee ?? '',
      maxRadiusKm: value.maxRadiusKm ?? '',
      estimatedMinMinutes: value.estimatedMinMinutes ?? '',
      estimatedMaxMinutes: value.estimatedMaxMinutes ?? '',
      storeIds: (value.stores || []).map(s => s.storeId),
    });
  }, [value]);

  const submit = () => onSave(form);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{form.id ? 'Edit Delivery Zone' : 'Create Delivery Zone'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Zone Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Priority (lower = higher precedence)"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Base Delivery Fee (KES)"
              value={form.baseDeliveryFee}
              onChange={(e) => setForm((f) => ({ ...f, baseDeliveryFee: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Minimum Order Value (KES)"
              value={form.minOrderValue}
              onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Per KM Fee (KES)"
              value={form.perKmFee}
              onChange={(e) => setForm((f) => ({ ...f, perKmFee: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Max Radius (KM)"
              value={form.maxRadiusKm}
              onChange={(e) => setForm((f) => ({ ...f, maxRadiusKm: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="ETA Min (minutes)"
              value={form.estimatedMinMinutes}
              onChange={(e) => setForm((f) => ({ ...f, estimatedMinMinutes: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="ETA Max (minutes)"
              value={form.estimatedMaxMinutes}
              onChange={(e) => setForm((f) => ({ ...f, estimatedMaxMinutes: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="zone-stores-label">Stores Covered</InputLabel>
              <Select
                labelId="zone-stores-label"
                multiple
                value={form.storeIds}
                input={<OutlinedInput label="Stores Covered" />}
                onChange={(e) => setForm((f) => ({ ...f, storeIds: e.target.value }))}
                MenuProps={{ PaperProps: { sx: { maxHeight: AUDIENCE_ITEM_HEIGHT * 8 } } }}
              >
                {stores.map((store) => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name} ({store.category})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
              }
              label="Zone active"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !form.name.trim()}>
          {saving ? 'Saving...' : (form.id ? 'Update Zone' : 'Create Zone')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Zones() {
  const [zones, setZones] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [zonesRes, storesRes] = await Promise.all([
        axios.get('/api/admin/zones'),
        axios.get('/api/stores'),
      ]);
      setZones(zonesRes.data || []);
      setStores(storesRes.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load zones data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (zone) => {
    setEditing(zone);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const saveZone = async (payload) => {
    setSaving(true);
    setError('');
    try {
      const body = {
        name: payload.name,
        description: payload.description,
        isActive: payload.isActive,
        priority: payload.priority,
        minOrderValue: payload.minOrderValue,
        baseDeliveryFee: payload.baseDeliveryFee,
        perKmFee: payload.perKmFee,
        maxRadiusKm: payload.maxRadiusKm,
        estimatedMinMinutes: payload.estimatedMinMinutes,
        estimatedMaxMinutes: payload.estimatedMaxMinutes,
      };

      if (payload.id) {
        await axios.put(`/api/admin/zones/${payload.id}`, body);
        await axios.post(`/api/admin/zones/${payload.id}/stores`, { storeIds: payload.storeIds });
      } else {
        await axios.post('/api/admin/zones', { ...body, storeIds: payload.storeIds });
      }

      closeDialog();
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save zone');
    } finally {
      setSaving(false);
    }
  };

  const deleteZone = async (zoneId) => {
    const ok = window.confirm('Delete this zone? This cannot be undone.');
    if (!ok) return;
    try {
      await axios.delete(`/api/admin/zones/${zoneId}`);
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete zone');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Zone Management</Typography>
          <Typography variant="caption" color="text.secondary">
            Configure service zones, delivery fees, and store coverage rules
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData} disabled={loading}>Refresh</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Zone</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><b>Zone</b></TableCell>
                        <TableCell><b>Priority</b></TableCell>
                        <TableCell><b>Delivery Rule</b></TableCell>
                        <TableCell><b>Min Order</b></TableCell>
                        <TableCell><b>ETA</b></TableCell>
                        <TableCell><b>Stores</b></TableCell>
                        <TableCell><b>Status</b></TableCell>
                        <TableCell><b>Actions</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {zones.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4 }}>No zones configured yet</TableCell>
                        </TableRow>
                      ) : zones.map((zone) => (
                        <TableRow key={zone.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>{zone.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{zone.description || '—'}</Typography>
                          </TableCell>
                          <TableCell>{zone.priority}</TableCell>
                          <TableCell>
                            <Typography variant="body2">Base: {formatKES(zone.baseDeliveryFee || 0)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {zone.perKmFee ? `+ ${formatKES(zone.perKmFee)}/km` : 'No distance surcharge'}
                            </Typography>
                          </TableCell>
                          <TableCell>{zone.minOrderValue ? formatKES(zone.minOrderValue) : '—'}</TableCell>
                          <TableCell>
                            {zone.estimatedMinMinutes && zone.estimatedMaxMinutes
                              ? `${zone.estimatedMinMinutes}-${zone.estimatedMaxMinutes} min`
                              : '—'}
                          </TableCell>
                          <TableCell>{zone.stores?.length || 0}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={zone.isActive ? 'Active' : 'Paused'}
                              color={zone.isActive ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(zone)}>Edit</Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => deleteZone(zone.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <ZoneDialog
        open={dialogOpen}
        onClose={closeDialog}
        onSave={saveZone}
        stores={stores}
        value={editing}
        saving={saving}
      />
    </Box>
  );
}
