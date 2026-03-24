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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';

function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [driverId, setDriverId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [driversRes, usersRes] = await Promise.all([
        axios.get('/api/drivers'),
        axios.get('/api/users')
      ]);
      setDrivers(driversRes.data);
      const assignedUserIds = new Set(driversRes.data.map((driver) => driver.userId));
      setUsers(usersRes.data.filter((user) => user.role === 'DRIVER' && !assignedUserIds.has(user.id)));
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    // Reset form
    setDriverId('');
    setName('');
    setPhone('');
    setVehicle('');
    setUserId('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (driverId) {
        // Update driver
        await axios.put(`/api/drivers/${driverId}`, {
          name,
          phone,
          vehicle
        });
        setSnackbarMessage('Driver updated successfully!');
        setSnackbarSeverity('success');
      } else {
        if (!userId) {
          setError('Please select a DRIVER user for this driver profile');
          setSnackbarMessage('Please select a DRIVER user for this driver profile');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          return;
        }

        // Create driver
        await axios.post('/api/drivers', {
          name,
          phone,
          vehicle,
          userId
        });
        setSnackbarMessage('Driver created successfully!');
        setSnackbarSeverity('success');
      }
      
      setOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save driver');
      setSnackbarMessage(err.response?.data?.error || 'Failed to save driver');
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this driver?')) {
      try {
        await axios.delete(`/api/drivers/${id}`);
        setSnackbarMessage('Driver deleted successfully!');
        setSnackbarSeverity('success');
        await fetchData();
      } catch (err) {
        setSnackbarMessage('Failed to delete driver');
        setSnackbarSeverity('error');
      } finally {
        setSnackbarOpen(true);
      }
    }
  };

  const handleEdit = (driver) => {
    setDriverId(driver.id);
    setName(driver.name);
    setPhone(driver.phone);
    setVehicle(driver.vehicle);
    setUserId(driver.userId);
    setOpen(true);
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
        <Typography variant="h4">Drivers Management</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpen}>
          Add Driver
        </Button>
      </Box>
      
      {loading ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {drivers.length === 0 ? (
            <Typography color="text.secondary">No drivers found</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>{driver.name}</TableCell>
                      <TableCell>{driver.phone}</TableCell>
                      <TableCell>{driver.vehicle}</TableCell>
                      <TableCell>{driver.user?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEdit(driver)}>
                          Edit
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<DeleteIcon />} color="error" onClick={() => handleDelete(driver.id)}>
                          Delete
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
      
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{driverId ? 'Edit Driver' : 'Add Driver'}</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Driver Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              mb={2}
              required
            >
              <InputLabel shrink>Driver Name</InputLabel>
            </TextField>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Phone</InputLabel>
              </TextField>
              <TextField
                label="Vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Vehicle</InputLabel>
              </TextField>
            </Box>
            <FormControl fullWidth>
              <InputLabel id="user-label">User</InputLabel>
              <Select
                labelId="user-label"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                label="User"
                required={!driverId}
              >
                <MenuItem value="">Select a DRIVER user</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.username} ({user.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {error && (
              <Typography color="error" mb={2}>
                {error}
              </Typography>
            )}
            {success && (
              <Typography color="success" mb={2}>
                {success}
              </Typography>
            )}
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            {driverId ? 'Update Driver' : 'Add Driver'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Drivers;