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
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Rating,
  Card,
  Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TimelineIcon from '@mui/icons-material/Timeline';
import axios from 'axios';

// Use backend URL directly
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
const apiClient = axios.create({ baseURL: API_BASE_URL });

function DriverManager() {
  // State
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle: '',
    license: '',
    username: '',
    password: ''
  });
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return {};
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      getAuthConfig();
      const response = await apiClient.get('/api/drivers');
      setDrivers(response.data || []);
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to load drivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverOrders = async (driverId) => {
    try {
      getAuthConfig();
      const response = await apiClient.get('/api/orders');
      const driverOrders = (response.data || []).filter((order) => order.driverId === driverId);
      setOrders(driverOrders);
    } catch (err) {
      showSnackbar('Failed to load driver orders', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDialog = () => {
    setFormData({ name: '', email: '', phone: '', vehicle: '', license: '', username: '', password: '' });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedDriver(null);
  };

  const handleCloseOrdersDialog = () => {
    setOrdersDialogOpen(false);
    setSelectedDriver(null);
    setOrders([]);
  };

  const handleOpenEditDialog = (driver) => {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name || '',
      email: driver.user?.email || '',
      phone: driver.phone || '',
      vehicle: driver.vehicle || '',
      license: driver.license || '',
      username: driver.user?.username || '',
      password: ''
    });
    setEditDialogOpen(true);
  };

  const handleOpenOrdersDialog = (driver) => {
    setSelectedDriver(driver);
    fetchDriverOrders(driver.id);
    setOrdersDialogOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.phone.trim() || !formData.vehicle.trim() || !formData.username.trim() || !formData.password.trim()) {
      showSnackbar('Name, phone, vehicle, username, and password are required', 'error');
      return;
    }

    if (formData.password.trim().length < 6) {
      showSnackbar('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      getAuthConfig();
      
      const userRes = await apiClient.post('/api/users', {
        username: formData.username.trim(),
        password: formData.password.trim(),
        role: 'DRIVER',
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone
      });

      await apiClient.post('/api/drivers', {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        vehicle: formData.vehicle,
        license: formData.license || null,
        userId: userRes.data.id
      });

      showSnackbar('Driver created successfully with login credentials!');
      setDialogOpen(false);
      setFormData({ name: '', email: '', phone: '', vehicle: '', license: '', username: '', password: '' });
      fetchDrivers();
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to create driver', 'error');
    }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();

    if (!selectedDriver) return;

    try {
      getAuthConfig();

      await apiClient.put(`/api/users/${selectedDriver.userId}`, {
        username: formData.username,
        password: formData.password.trim() ? formData.password.trim() : undefined,
        role: 'DRIVER',
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null
      });

      await apiClient.put(`/api/drivers/${selectedDriver.id}`, {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        vehicle: formData.vehicle,
        license: formData.license || null
      });

      showSnackbar('Driver profile and credentials updated successfully!');
      setEditDialogOpen(false);
      setSelectedDriver(null);
      fetchDrivers();
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to update driver', 'error');
    }
  };

  const handleDeleteDriver = async (driver) => {
    if (!window.confirm(`Delete driver ${driver.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      getAuthConfig();
      await apiClient.delete(`/api/drivers/${driver.id}`);
      showSnackbar('Driver deleted successfully!');
      fetchDrivers();
    } catch (err) {
      showSnackbar(err?.response?.data?.error || 'Failed to delete driver', 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Driver Fleet Management</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />} 
          onClick={handleOpenDialog}
        >
          Add Driver
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Summary Stats */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Total Drivers</Typography>
                <Typography variant="h4">{drivers.length}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Available</Typography>
                <Typography variant="h4">{drivers.filter(d => d.available !== false).length}</Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Avg Rating</Typography>
                <Typography variant="h4">
                  {drivers.length > 0 
                    ? (drivers.reduce((sum, d) => sum + (d.rating || 0), 0) / drivers.length).toFixed(1)
                    : 'N/A'
                  }
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Active Today</Typography>
                <Typography variant="h4">{drivers.filter(d => d.available).length}</Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Drivers Table */}
          {drivers.length === 0 ? (
            <Typography color="textSecondary">No drivers found</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>License</TableCell>
                    <TableCell>Rating</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>{driver.name}</TableCell>
                      <TableCell>{driver.phone}</TableCell>
                      <TableCell>{driver.vehicle}</TableCell>
                      <TableCell>{driver.license || 'N/A'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Rating value={driver.rating || 0} readOnly size="small" />
                          <Typography variant="caption">{driver.rating ? driver.rating.toFixed(1) : '0'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={driver.available !== false ? 'Available' : 'Offline'}
                          color={driver.available !== false ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<TimelineIcon />}
                          onClick={() => handleOpenOrdersDialog(driver)}
                          sx={{ mr: 1 }}
                        >
                          Orders
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => handleOpenEditDialog(driver)}
                          sx={{ mr: 1 }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDeleteDriver(driver)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Create Driver Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Driver</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              helperText="Minimum 6 characters"
              fullWidth
              required
            />
            <TextField
              label="Vehicle (e.g., Motorbike, Car)"
              name="vehicle"
              value={formData.vehicle}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label="License Number"
              name="license"
              value={formData.license}
              onChange={handleInputChange}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleCreateDriver} variant="contained" color="primary">
            Create Driver
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Driver Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Driver</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="New Password (optional)"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              helperText="Leave blank to keep current password"
              fullWidth
            />
            <TextField
              label="Vehicle"
              name="vehicle"
              value={formData.vehicle}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="License Number"
              name="license"
              value={formData.license}
              onChange={handleInputChange}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleUpdateDriver} variant="contained" color="primary">
            Update Driver
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Orders Dialog */}
      <Dialog open={ordersDialogOpen} onClose={handleCloseOrdersDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedDriver ? `Orders for ${selectedDriver.name}` : 'Driver Orders'}
        </DialogTitle>
        <DialogContent>
          {orders.length === 0 ? (
            <Typography color="textSecondary" sx={{ pt: 2 }}>
              No orders for this driver
            </Typography>
          ) : (
            <TableContainer sx={{ pt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.orderNumber || `FK-${String(order.id).replace(/-/g, '').slice(-6).toUpperCase()}`}</TableCell>
                      <TableCell>
                        <Chip 
                          label={order.status} 
                          size="small"
                          color={order.status === 'DELIVERED' ? 'success' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>KES {Number(order.total || 0).toFixed(2)}</TableCell>
                      <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOrdersDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DriverManager;
