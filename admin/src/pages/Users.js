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

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    // Reset form
    setUserId('');
    setUsername('');
    setPassword('');
    setRole('');
    setName('');
    setEmail('');
    setPhone('');
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
      if (userId) {
        // Update user
        await axios.put(`/api/users/${userId}`, {
          username,
          password: password || undefined,
          role,
          name,
          email: email || null,
          phone: phone || null
        });
        setSnackbarMessage('User updated successfully!');
        setSnackbarSeverity('success');
      } else {
        // Create user
        await axios.post('/api/users', {
          username,
          password,
          role,
          name,
          email: email || null,
          phone: phone || null
        });
        setSnackbarMessage('User created successfully!');
        setSnackbarSeverity('success');
      }
      
      setOpen(false);
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
      setSnackbarMessage(err.response?.data?.error || 'Failed to save user');
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`/api/users/${id}`);
        setSnackbarMessage('User deleted successfully!');
        setSnackbarSeverity('success');
        await fetchUsers();
      } catch (err) {
        setSnackbarMessage('Failed to delete user');
        setSnackbarSeverity('error');
      } finally {
        setSnackbarOpen(true);
      }
    }
  };

  const handleEdit = (user) => {
    setUserId(user.id);
    setUsername(user.username);
    setRole(user.role);
    setName(user.name);
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setOpen(true);
    // We don't pre-fill password for security reasons
  };

  const getRoleChipColor = (role) => {
    switch (role) {
      case 'ADMIN': return 'primary';
      case 'MERCHANT': return 'success';
      case 'CUSTOMER': return 'info';
      case 'DRIVER': return 'warning';
      default: return 'grey';
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
        <Typography variant="h4">Users Management</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpen}>
          Add User
        </Button>
      </Box>
      
      {loading ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {users.length === 0 ? (
            <Typography color="text.secondary">No users found</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        <Chip label={user.role} color={getRoleChipColor(user.role)} />
                      </TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEdit(user)}>
                          Edit
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<DeleteIcon />} color="error" onClick={() => handleDelete(user.id)}>
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
        <DialogTitle>{userId ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              mb={2}
              required
            >
              <InputLabel shrink>Username</InputLabel>
            </TextField>
            {userId ? null : (
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                mb={2}
                required
              >
                <InputLabel shrink>Password</InputLabel>
              </TextField>
            )}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Name</InputLabel>
              </TextField>
              <FormControl fullWidth>
                <InputLabel id="role-label">Role</InputLabel>
                <Select
                  labelId="role-label"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  label="Role"
                >
                  <MenuItem value="ADMIN">Admin</MenuItem>
                  <MenuItem value="MERCHANT">Merchant</MenuItem>
                  <MenuItem value="CUSTOMER">Customer</MenuItem>
                  <MenuItem value="DRIVER">Driver</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Email</InputLabel>
              </TextField>
              <TextField
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Phone</InputLabel>
              </TextField>
            </Box>
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
            {userId ? 'Update User' : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Users;