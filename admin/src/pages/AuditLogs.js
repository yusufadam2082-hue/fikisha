import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, CircularProgress, Alert, Chip, Button,
  FormControl, InputLabel, Select, MenuItem, Pagination, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';

const ENTITY_COLORS = {
  ORDER: 'primary', DRIVER: 'warning', USER: 'info',
  STORE: 'secondary', PROMOTION: 'success', SYSTEM: 'default',
};
const ACTION_COLORS = {
  ORDER_CANCELLED: 'error', REFUND_ISSUED: 'warning',
  DRIVER_SUSPENDED: 'error', DRIVER_REACTIVATED: 'success',
  STORE_SUSPENDED: 'error', STORE_REACTIVATED: 'success',
  DRIVER_FORCE_ASSIGNED: 'primary',
};

function DiffDialog({ log, open, onClose }) {
  if (!log) return null;
  let before = null, after = null;
  try { before = JSON.parse(log.before || 'null'); } catch {}
  try { after  = JSON.parse(log.after  || 'null'); } catch {}

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Audit Entry — {log.action}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {log.admin?.name} ({log.admin?.username}) · {new Date(log.createdAt).toLocaleString()}
        </Typography>
        {log.note && <Box mb={2}><Typography variant="body2"><b>Note:</b> {log.note}</Typography></Box>}
        {before !== null && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="error.main">Before</Typography>
            <Paper variant="outlined" sx={{ p: 1.5, fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', background: '#fff8f8' }}>
              {JSON.stringify(before, null, 2)}
            </Paper>
          </Box>
        )}
        {after !== null && (
          <Box>
            <Typography variant="subtitle2" color="success.main">After</Typography>
            <Paper variant="outlined" sx={{ p: 1.5, fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', background: '#f0fff0' }}>
              {JSON.stringify(after, null, 2)}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterEntity, setFilterEntity] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: p, limit: 50 };
      if (filterEntity) params.entityType = filterEntity;
      const res = await axios.get('/api/admin/audit-logs', { params });
      setLogs(res.data.logs || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filterEntity]);

  useEffect(() => { setPage(1); fetchLogs(1); }, [fetchLogs]);
  useEffect(() => { fetchLogs(page); }, [page]); // eslint-disable-line

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Audit Logs</Typography>
          <Typography variant="caption" color="text.secondary">{total} total events recorded</Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => fetchLogs(page)} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Entity Type</InputLabel>
          <Select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} label="Entity Type">
            <MenuItem value="">All</MenuItem>
            {Object.keys(ENTITY_COLORS).map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
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
                  <TableCell><b>Admin</b></TableCell>
                  <TableCell><b>Action</b></TableCell>
                  <TableCell><b>Entity</b></TableCell>
                  <TableCell><b>Entity ID</b></TableCell>
                  <TableCell><b>Note</b></TableCell>
                  <TableCell><b>Diff</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>No audit events yet</TableCell>
                  </TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{log.admin?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{log.admin?.username}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={log.action} color={ACTION_COLORS[log.action] || 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.entityType} color={ENTITY_COLORS[log.entityType] || 'default'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {log.entityId ? (
                        <Tooltip title={log.entityId}><span>{log.entityId.slice(-8).toUpperCase()}</span></Tooltip>
                      ) : '—'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap' }}>
                        {log.note || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(log.before || log.after) && (
                        <Button size="small" onClick={() => setSelectedLog(log)}>View</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        </>
      )}

      <DiffDialog log={selectedLog} open={!!selectedLog} onClose={() => setSelectedLog(null)} />
    </Box>
  );
}
