import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, CircularProgress, Alert, Chip, Button,
  FormControl, InputLabel, Select, MenuItem, Pagination,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';

const STATUS_OPTIONS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const STATUS_COLOR = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'default',
};

function resolveErrorMessage(error) {
  const status = error?.response?.status;
  const apiError = error?.response?.data?.error;
  if (apiError) return apiError;
  if (status === 401) return 'Session expired or unauthorized. Please log in again.';
  if (status === 404) return 'Support ticket endpoint not found on the active API server.';
  if (status) return `Failed to load support tickets (HTTP ${status})`;
  return 'Failed to load support tickets. Check API connectivity.';
}

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('ALL');

  const fetchTickets = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/admin/support-tickets', {
        params: {
          page: nextPage,
          limit: 25,
          status,
        },
      });
      setTickets(res.data.tickets || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (e) {
      setError(resolveErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setPage(1);
    fetchTickets(1);
  }, [fetchTickets]);

  useEffect(() => {
    fetchTickets(page);
  }, [page, fetchTickets]); // eslint-disable-line

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Support Tickets</Typography>
          <Typography variant="caption" color="text.secondary">
            {total} merchant ticket{total === 1 ? '' : 's'} submitted
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => fetchTickets(page)} disabled={loading}>
          Refresh
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
            {STATUS_OPTIONS.map((value) => (
              <MenuItem key={value} value={value}>{value === 'ALL' ? 'All' : value.replace(/_/g, ' ')}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Time</b></TableCell>
                  <TableCell><b>Store</b></TableCell>
                  <TableCell><b>Merchant</b></TableCell>
                  <TableCell><b>Subject</b></TableCell>
                  <TableCell><b>Priority</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                  <TableCell><b>Description</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>No tickets found</TableCell>
                  </TableRow>
                ) : tickets.map((ticket) => (
                  <TableRow key={ticket.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {new Date(ticket.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{ticket.store?.name || 'Unknown store'}</TableCell>
                    <TableCell>
                      {ticket.merchant?.name || ticket.merchant?.username || 'Unknown merchant'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{ticket.subject}</TableCell>
                    <TableCell>{ticket.priority || 'NORMAL'}</TableCell>
                    <TableCell>
                      <Chip
                        label={ticket.status}
                        size="small"
                        color={STATUS_COLOR[ticket.status] || 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 340 }}>
                      <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                        {ticket.description}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} color="primary" />
          </Box>
        </>
      )}
    </Box>
  );
}
