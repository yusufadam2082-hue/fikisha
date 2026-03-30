import React, { useEffect, useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputLabel,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import apiClient from '../utils/apiClient';
import { formatKES } from '../utils/currency';
import { appendStoreSecurityEvent } from '../utils/storeSecurityLog';

function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(5);
  const [time, setTime] = useState('20-30 min');
  const [deliveryFee, setDeliveryFee] = useState(2.99);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [manageCredentialsOpen, setManageCredentialsOpen] = useState(false);
  const [credentialsStoreId, setCredentialsStoreId] = useState('');
  const [credentialsStoreName, setCredentialsStoreName] = useState('');
  const [credentialsName, setCredentialsName] = useState('');
  const [credentialsUsername, setCredentialsUsername] = useState('');
  const [credentialsEmail, setCredentialsEmail] = useState('');
  const [credentialsPhone, setCredentialsPhone] = useState('');
  const [credentialsPassword, setCredentialsPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState({
    storeName: '',
    ownerName: '',
    username: '',
    password: ''
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchStores();
  }, []);

  const getApiErrorMessage = (err, fallback) => {
    const status = err?.response?.status;
    const apiMessage = err?.response?.data?.error || err?.response?.data?.message;
    const localMessage = err?.message;

    if (status === 401) {
      return `Unauthorized (401): ${apiMessage || 'Please log in again.'}`;
    }

    if (status === 403) {
      return `Forbidden (403): ${apiMessage || 'You do not have permission for this action.'}`;
    }

    if (status && apiMessage) {
      return `${apiMessage} (${status})`;
    }

    return localMessage || fallback;
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return {};
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      getAuthConfig();
      const res = await apiClient.get('/api/stores');
      setStores(res.data);
    } catch (err) {
      console.error('Failed to fetch stores', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setName('');
    setCategory('');
    setImage('');
    setDescription('');
    setRating(5);
    setTime('20-30 min');
    setDeliveryFee(2.99);
    setAddress('');
    setPhone('');
    setOwnerName('');
    setOwnerUsername('');
    setOwnerEmail('');
    setOwnerPhone('');
    setOwnerPassword('');
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleCloseCredentialsDialog = () => {
    setCredentialsDialogOpen(false);
  };

  const openCredentialsEditor = (store) => {
    setCredentialsStoreId(store.id);
    setCredentialsStoreName(store.name);
    setCredentialsName(store.owner?.name || '');
    setCredentialsUsername(store.owner?.username || '');
    setCredentialsEmail(store.owner?.email || '');
    setCredentialsPhone(store.owner?.phone || '');
    setCredentialsPassword('');
    setManageCredentialsOpen(true);
  };

  const handleCloseCredentialsEditor = () => {
    setManageCredentialsOpen(false);
  };

  const handleCopyText = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setSnackbarMessage(`${label} copied`);
      setSnackbarSeverity('success');
    } catch {
      setSnackbarMessage(`Failed to copy ${label.toLowerCase()}`);
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (!ownerName.trim() || !ownerUsername.trim() || !ownerPassword.trim()) {
        throw new Error('Owner name, username and password are required for new stores');
      }

      if (ownerPassword.trim().length < 6) {
        throw new Error('Owner password must be at least 6 characters');
      }

      getAuthConfig();
      const createRes = await apiClient.post('/api/stores', {
        name,
        category,
        image,
        description,
        rating,
        time,
        deliveryFee,
        address,
        phone,
        ownerName,
        ownerUsername,
        ownerEmail,
        ownerPhone,
        ownerPassword
      });

      setCreatedCredentials({
        storeName: createRes.data?.name || name,
        ownerName: createRes.data?.owner?.name || ownerName,
        username: createRes.data?.owner?.username || ownerUsername,
        password: ownerPassword
      });

      appendStoreSecurityEvent({
        storeId: createRes.data?.id,
        type: 'STORE_CREATED',
        message: `Store ${createRes.data?.name || name} created`,
        metadata: {
          ownerUsername: createRes.data?.owner?.username || ownerUsername
        }
      });

      setCredentialsDialogOpen(true);
      setSnackbarMessage('Store created successfully!');
      setSnackbarSeverity('success');
      setOpen(false);
      await fetchStores();
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to save store');
      setError(message);
      setSnackbarMessage(message);
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleToggleStoreStatus = async (store) => {
    const nextIsOpen = store.isOpen === false;

    try {
      getAuthConfig();
      await apiClient.put(`/api/stores/${store.id}`, { isOpen: nextIsOpen });

      appendStoreSecurityEvent({
        storeId: store.id,
        type: nextIsOpen ? 'STORE_OPENED' : 'STORE_CLOSED',
        message: nextIsOpen ? `Store ${store.name} opened` : `Store ${store.name} closed`,
        metadata: {
          previous: store.isOpen === false ? 'closed' : 'open',
          current: nextIsOpen ? 'open' : 'closed'
        }
      });

      setSnackbarMessage(nextIsOpen ? 'Store opened successfully' : 'Store closed successfully');
      setSnackbarSeverity('success');
      await fetchStores();
    } catch (err) {
      setSnackbarMessage(getApiErrorMessage(err, 'Failed to update store status'));
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!credentialsStoreId) {
      return;
    }

    try {
      const payload = {
        ownerName: credentialsName,
        ownerUsername: credentialsUsername,
        ownerEmail: credentialsEmail || null,
        ownerPhone: credentialsPhone || null
      };

      if (credentialsPassword.trim()) {
        payload.ownerPassword = credentialsPassword.trim();
      }

      getAuthConfig();
      await apiClient.put(`/api/stores/${credentialsStoreId}/credentials`, payload);

      appendStoreSecurityEvent({
        storeId: credentialsStoreId,
        type: 'MERCHANT_CREDENTIALS_UPDATED',
        message: `Credentials updated for ${credentialsUsername}`,
        metadata: {
          ownerUsername: credentialsUsername,
          passwordChanged: Boolean(credentialsPassword.trim())
        }
      });

      setManageCredentialsOpen(false);
      setSnackbarMessage('Merchant credentials updated successfully');
      setSnackbarSeverity('success');
      await fetchStores();
    } catch (err) {
      setSnackbarMessage(getApiErrorMessage(err, 'Failed to update merchant credentials'));
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
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
        <Typography variant="h4">Stores Management</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpen}>
          Add Store
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {stores.length === 0 ? (
            <Typography color="text.secondary">No stores found</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Rating</TableCell>
                    <TableCell>Delivery Fee</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>{store.name}</TableCell>
                      <TableCell>{store.category}</TableCell>
                      <TableCell>{store.isOpen === false ? 'Closed' : 'Open'}</TableCell>
                      <TableCell>{store.rating}</TableCell>
                      <TableCell>{formatKES(Number(store.deliveryFee || 0))}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PowerSettingsNewIcon />}
                          color={store.isOpen === false ? 'success' : 'warning'}
                          onClick={() => handleToggleStoreStatus(store)}
                          sx={{ mr: 1 }}
                        >
                          {store.isOpen === false ? 'Open' : 'Close'}
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<LockResetIcon />} onClick={() => openCredentialsEditor(store)}>
                          Credentials
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Store</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField label="Store Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth mb={2} required />
            <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth mb={2} required />
            <TextField label="Image URL" value={image} onChange={(e) => setImage(e.target.value)} fullWidth mb={2} />
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth mb={2} multiline rows={4} />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Rating"
                type="number"
                value={rating}
                onChange={(e) => setRating(parseInt(e.target.value, 10) || 5)}
                InputLabelProps={{ shrink: true }}
              >
                <InputLabel shrink>Rating</InputLabel>
              </TextField>
              <TextField label="Time" value={time} onChange={(e) => setTime(e.target.value)} fullWidth>
                <InputLabel shrink>Prep Time</InputLabel>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Delivery Fee (KES)"
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 2.99)}
                InputLabelProps={{ shrink: true }}
              >
                <InputLabel shrink>Delivery Fee</InputLabel>
              </TextField>
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth>
                <InputLabel shrink>Phone</InputLabel>
              </TextField>
            </Box>
            <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth mb={2}>
              <InputLabel shrink>Address</InputLabel>
            </TextField>
            <Typography variant="h6" gutterBottom mb={2}>Merchant Credentials (for this store)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              These credentials are used by the merchant to log in and manage this store.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} fullWidth required>
                <InputLabel shrink>Owner Name</InputLabel>
              </TextField>
              <TextField label="Owner Username" value={ownerUsername} onChange={(e) => setOwnerUsername(e.target.value)} fullWidth required>
                <InputLabel shrink>Owner Username</InputLabel>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="Owner Email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} fullWidth>
                <InputLabel shrink>Owner Email</InputLabel>
              </TextField>
              <TextField label="Owner Phone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} fullWidth>
                <InputLabel shrink>Owner Phone</InputLabel>
              </TextField>
            </Box>
            <TextField
              label="Owner Password"
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              fullWidth
              mb={2}
              required
              helperText="Minimum 6 characters"
            >
              <InputLabel shrink>Owner Password</InputLabel>
            </TextField>
            {error && (
              <Typography color="error" mb={2}>
                {error}
              </Typography>
            )}
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSubmit}>Add Store</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manageCredentialsOpen} onClose={handleCloseCredentialsEditor} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Merchant Credentials - {credentialsStoreName}</DialogTitle>
        <DialogContent>
          <TextField label="Merchant Name" value={credentialsName} onChange={(e) => setCredentialsName(e.target.value)} fullWidth margin="dense" />
          <TextField label="Merchant Username" value={credentialsUsername} onChange={(e) => setCredentialsUsername(e.target.value)} fullWidth margin="dense" />
          <TextField label="Merchant Email" type="email" value={credentialsEmail} onChange={(e) => setCredentialsEmail(e.target.value)} fullWidth margin="dense" />
          <TextField label="Merchant Phone" value={credentialsPhone} onChange={(e) => setCredentialsPhone(e.target.value)} fullWidth margin="dense" />
          <TextField
            label="New Password (optional)"
            type="password"
            value={credentialsPassword}
            onChange={(e) => setCredentialsPassword(e.target.value)}
            fullWidth
            margin="dense"
            helperText="Leave blank to keep existing password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCredentialsEditor}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateCredentials}>Save Credentials</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={credentialsDialogOpen} onClose={handleCloseCredentialsDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Merchant Credentials Created</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Store {createdCredentials.storeName} has been created with a dedicated merchant account.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save these credentials now. For security reasons, the password is shown only once.
          </Typography>

          <TextField label="Merchant Name" value={createdCredentials.ownerName} fullWidth margin="dense" InputProps={{ readOnly: true }} />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField label="Merchant Username" value={createdCredentials.username} fullWidth margin="dense" InputProps={{ readOnly: true }} />
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => handleCopyText('Username', createdCredentials.username)}
              sx={{ mt: 1 }}
            >
              Copy
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField label="Merchant Password" value={createdCredentials.password} type="text" fullWidth margin="dense" InputProps={{ readOnly: true }} />
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => handleCopyText('Password', createdCredentials.password)}
              sx={{ mt: 1 }}
            >
              Copy
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2 }}>
            Merchant login path: /merchant/login.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCloseCredentialsDialog}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Stores;
