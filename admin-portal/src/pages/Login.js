import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Paper, Avatar, Link } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="main" sx={{ height: '100vh', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Paper component="form" elevation={3} sx={{ p: 4, maxWidth: 450, width: '100%' }} onSubmit={handleSubmit}>
        <Avatar sx={{ margin: '0 auto 16px', width: 80, height: 80 }}>
          <LockOutlinedIcon fontSize="large" />
        </Avatar>
        <Typography component="h1" variant="h5" align="center" sx={{ mb: 4 }}>
          Admin Login
        </Typography>
        <Box mb={3}>
          <TextField
            label="Username"
            type="text"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            sx={{ mb: 2 }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Box>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          color="primary"
          sx={{ mt: 3 }}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Link href="#" variant="body2">
            Forgot password?
          </Link>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;