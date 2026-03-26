import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Chip, Pagination, OutlinedInput,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'All users' },
  { value: 'CUSTOMERS', label: 'Customers only' },
  { value: 'STORES', label: 'Stores / merchants only' },
  { value: 'DRIVERS', label: 'Drivers only' },
  { value: 'STORE_IDS', label: 'Selected stores only' },
  { value: 'USER_IDS', label: 'Selected user IDs only' },
];

export default function Notifications() {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [channel, setChannel] = useState('IN_APP');
  const [storeIds, setStoreIds] = useState([]);
  const [userIdsRaw, setUserIdsRaw] = useState('');

  const fetchData = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, campaignsRes, storesRes] = await Promise.all([
        axios.get('/api/admin/notifications/audience-stats'),
        axios.get('/api/admin/notifications/campaigns', { params: { page: p, limit: 15 } }),
        axios.get('/api/stores'),
      ]);
      setStats(statsRes.data);
      setCampaigns(campaignsRes.data.campaigns || []);
      setTotalPages(campaignsRes.data.pages || 1);
      setStores(storesRes.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load notifications data');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(1); }, []); // eslint-disable-line
  useEffect(() => { fetchData(page); }, [page]); // eslint-disable-line

  const sendBroadcast = async () => {
    setError('');
    setSuccess('');
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required');
      return;
    }

    setSending(true);
    try {
      const parsedUserIds = userIdsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        title,
        message,
        audience,
        channel,
        storeIds,
        userIds: parsedUserIds,
      };

      const res = await axios.post('/api/admin/notifications/broadcast', body);
      setSuccess(`Broadcast sent to ${res.data.sentCount} recipients`);
      setTitle('');
      setMessage('');
      setUserIdsRaw('');
      setStoreIds([]);
      setAudience('ALL');
      await fetchData(1);
      setPage(1);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Notifications & Broadcasts</Typography>
          <Typography variant="caption" color="text.secondary">
            Send admin announcements to customers, stores, and drivers
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetchData(page)} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={2} mb={2}>
        {[
          { label: 'Customers', value: stats?.customers ?? '—' },
          { label: 'Stores', value: stats?.stores ?? '—' },
          { label: 'Drivers', value: stats?.drivers ?? '—' },
          { label: 'Total Reachable Users', value: stats?.totalUsers ?? '—' },
        ].map((item) => (
          <Grid item xs={12} md={3} key={item.label}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                <Typography variant="h5" fontWeight={700}>{item.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <CampaignIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Compose Broadcast</Typography>
              </Box>

              <TextField
                fullWidth
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Audience</InputLabel>
                <Select value={audience} label="Audience" onChange={(e) => setAudience(e.target.value)}>
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Channel</InputLabel>
                <Select value={channel} label="Channel" onChange={(e) => setChannel(e.target.value)}>
                  <MenuItem value="IN_APP">In-app</MenuItem>
                </Select>
              </FormControl>

              {audience === 'STORE_IDS' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="stores-audience-label">Target Stores</InputLabel>
                  <Select
                    labelId="stores-audience-label"
                    multiple
                    value={storeIds}
                    input={<OutlinedInput label="Target Stores" />}
                    onChange={(e) => setStoreIds(e.target.value)}
                  >
                    {stores.map((store) => (
                      <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {audience === 'USER_IDS' && (
                <TextField
                  fullWidth
                  label="User IDs (comma separated)"
                  value={userIdsRaw}
                  onChange={(e) => setUserIdsRaw(e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}

              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={sendBroadcast}
                disabled={sending || loading}
                fullWidth
              >
                {sending ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>Recent Broadcast Campaigns</Typography>

              {loading ? (
                <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><b>Time</b></TableCell>
                          <TableCell><b>Title</b></TableCell>
                          <TableCell><b>Audience</b></TableCell>
                          <TableCell><b>Channel</b></TableCell>
                          <TableCell><b>Sent</b></TableCell>
                          <TableCell><b>Admin</b></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {campaigns.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 4 }}>No broadcasts sent yet</TableCell>
                          </TableRow>
                        ) : campaigns.map((c) => (
                          <TableRow key={c.id} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                              {new Date(c.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>{c.title}</Typography>
                              <Typography variant="caption" color="text.secondary">{c.message}</Typography>
                            </TableCell>
                            <TableCell><Chip label={c.audience} size="small" /></TableCell>
                            <TableCell>{c.channel}</TableCell>
                            <TableCell>{c.sentCount}</TableCell>
                            <TableCell>{c.createdBy?.name || c.createdBy?.username || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box display="flex" justifyContent="center" mt={2}>
                    <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
