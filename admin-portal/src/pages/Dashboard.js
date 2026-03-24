import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, CircularProgress, Box } from '@mui/material';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({
    totalStores: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalDrivers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [storesRes, productsRes, ordersRes, usersRes, driversRes] = await Promise.all([
          axios.get('/api/stores'),
          axios.get('/api/products'), // We'll need to create this endpoint
          axios.get('/api/orders'),
          axios.get('/api/users'), // We'll need to create this endpoint
          axios.get('/api/drivers')
        ]);
        
        setStats({
          totalStores: storesRes.data.length,
          totalProducts: productsRes.data.length,
          totalOrders: ordersRes.data.length,
          totalUsers: usersRes.data.length,
          totalDrivers: driversRes.data.length
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Stores
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {stats.totalStores}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Products
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {stats.totalProducts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Orders
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {stats.totalOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Users
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {stats.totalUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Drivers
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {stats.totalDrivers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;