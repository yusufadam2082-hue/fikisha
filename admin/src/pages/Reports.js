import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, CircularProgress, Alert,
  Button, TextField,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { formatKES } from '../utils/currency';

function SummaryCard({ label, value, sub, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={700} color={color || 'primary.main'} mt={0.5}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (from) params.from = from;
      if (to)   params.to   = to;
      const res = await axios.get('/api/admin/reports/overview', { params });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const fmtPct = (v) => `${v}%`;

  if (loading && !data) {
    return <Box display="flex" justifyContent="center" mt={8}><CircularProgress size={48} /></Box>;
  }

  const { summary = {}, charts = {}, topStores = [] } = data || {};

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>Reports & Analytics</Typography>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={fetchReports} disabled={loading}>Refresh</Button>
      </Box>

      {/* Date filters */}
      <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="wrap">
        <TextField type="date" label="From" value={from} onChange={e => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} size="small" />
        <TextField type="date" label="To" value={to} onChange={e => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }} size="small" />
        <Button variant="text" size="small" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary KPIs */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Gross GMV',           value: formatKES(summary.gmv),                color: 'success.main' },
          { label: 'Delivery Fee Revenue', value: formatKES(summary.fees),              color: 'info.main' },
          { label: 'Total Refunds Issued', value: formatKES(summary.refunds),           color: 'error.main' },
          { label: 'Avg. Order Value',     value: formatKES(summary.aov),               color: 'primary.main' },
          { label: 'Total Orders',         value: (summary.totalOrders || 0).toString() },
          { label: 'Delivered',            value: (summary.deliveredOrders || 0).toString(), sub: `Completion rate: ${fmtPct(summary.completionRate || 0)}`, color: 'success.main' },
          { label: 'Cancelled',            value: (summary.cancelledOrders || 0).toString(), sub: `Cancellation rate: ${fmtPct(summary.cancellationRate || 0)}`, color: 'error.main' },
        ].map(({ label, value, sub, color }) => (
          <Grid item xs={12} sm={6} md={3} key={label}>
            <SummaryCard label={label} value={value} sub={sub} color={color} />
          </Grid>
        ))}
      </Grid>

      {/* Revenue by Day */}
      {charts.revenueByDay?.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={700}>Revenue by Day</Typography>
              <Button size="small" startIcon={<DownloadIcon />}
                onClick={() => exportCSV(charts.revenueByDay, 'revenue-by-day.csv')}>
                Export CSV
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><b>Date</b></TableCell>
                    <TableCell align="right"><b>Revenue (KES)</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...charts.revenueByDay].reverse().map(row => (
                    <TableRow key={row.date} hover>
                      <TableCell>{row.date}</TableCell>
                      <TableCell align="right">{formatKES(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {/* Top Stores */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>Top Stores by Revenue</Typography>
                <Button size="small" startIcon={<DownloadIcon />}
                  onClick={() => exportCSV(topStores, 'top-stores.csv')}>
                  CSV
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell><b>Store</b></TableCell>
                      <TableCell align="right"><b>Orders</b></TableCell>
                      <TableCell align="right"><b>Revenue</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topStores.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center">No data</TableCell></TableRow>
                    ) : topStores.map((s, i) => (
                      <TableRow key={s.storeId} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell align="right">{s.orders}</TableCell>
                        <TableCell align="right">{formatKES(s.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Orders by Category */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>Orders by Category</Typography>
                <Button size="small" startIcon={<DownloadIcon />}
                  onClick={() => exportCSV(charts.ordersByCategory || [], 'orders-by-category.csv')}>
                  CSV
                </Button>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><b>Category</b></TableCell>
                      <TableCell align="right"><b>Orders</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(charts.ordersByCategory || []).length === 0 ? (
                      <TableRow><TableCell colSpan={2} align="center">No data</TableCell></TableRow>
                    ) : [...(charts.ordersByCategory || [])].sort((a, b) => b.count - a.count).map(row => (
                      <TableRow key={row.category} hover>
                        <TableCell>{row.category}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
