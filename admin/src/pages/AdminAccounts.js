import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import apiClient from '../utils/apiClient';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  roleId: '',
  password: '',
  confirmPassword: '',
  notes: '',
  isActive: true,
};

function AdminAccounts() {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const roleNameById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsRes, rolesRes] = await Promise.all([
        apiClient.get('/api/admin/admin-users'),
        apiClient.get('/api/admin/roles'),
      ]);

      setAdmins(Array.isArray(adminsRes.data) ? adminsRes.data : []);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setError('');
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to load admin accounts';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditingAdminId('');
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (admin) => {
    setEditingAdminId(admin.adminId || admin.id || '');
    setForm({
      fullName: admin.name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      roleId: admin.roleId || admin.adminRoleId || '',
      password: '',
      confirmPassword: '',
      notes: admin.notes || '',
      isActive: admin.isActive !== false,
    });
    setError('');
    setOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setOpen(false);
    setEditingAdminId('');
    setForm(emptyForm);
    setError('');
  };

  const showToast = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSave = async () => {
    setError('');

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.roleId.trim()) {
      setError('Full name, email, phone, and role are required.');
      return;
    }

    if (!editingAdminId && (!form.password.trim() || !form.confirmPassword.trim())) {
      setError('Password and confirm password are required for new admin accounts.');
      return;
    }

    if ((form.password || form.confirmPassword) && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        roleId: form.roleId,
        notes: form.notes.trim() || null,
        isActive: Boolean(form.isActive),
      };

      if (!editingAdminId || form.password.trim()) {
        payload.password = form.password.trim();
        payload.confirmPassword = form.confirmPassword.trim();
      }

      if (editingAdminId) {
        await apiClient.put(`/api/admin/admin-users/${editingAdminId}`, payload);
        showToast('Admin account updated successfully.');
      } else {
        await apiClient.post('/api/admin/admin-users', payload);
        showToast('Admin account created successfully.');
      }

      closeDialog();
      await fetchData();
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to save admin account';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
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
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>Admin Accounts</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage RBAC admin accounts (Super Admin permissions required).
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Create Admin
        </Button>
      </Box>

      {error && !open ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : null}

      {loading ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Login</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.adminId || admin.id}>
                    <TableCell>{admin.name || '-'}</TableCell>
                    <TableCell>{admin.email || '-'}</TableCell>
                    <TableCell>{admin.phone || '-'}</TableCell>
                    <TableCell>{admin.adminRoleName || roleNameById.get(admin.roleId || admin.adminRoleId) || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={admin.isActive === false ? 'Inactive' : 'Active'}
                        color={admin.isActive === false ? 'default' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => openEdit(admin)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No admin accounts found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAdminId ? 'Edit Admin Account' : 'Create Admin Account'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'grid', gap: 2 }}>
            <TextField
              label="Full Name"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel id="admin-role-label">Role</InputLabel>
              <Select
                labelId="admin-role-label"
                value={form.roleId}
                label="Role"
                onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={editingAdminId ? 'New Password (optional)' : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              fullWidth
              required={!editingAdminId}
            />
            <TextField
              label={editingAdminId ? 'Confirm New Password' : 'Confirm Password'}
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              fullWidth
              required={!editingAdminId || Boolean(form.password)}
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.isActive)}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
              }
              label="Active"
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : editingAdminId ? 'Save Changes' : 'Create Admin'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminAccounts;
