import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import apiClient from '../utils/apiClient';

const DOC_KEYS = [
  'ownerIdDocument',
  'businessPermitDocument',
  'taxPin',
  'proofOfAddressDocument'
];

const MISSING_LABELS = {
  ownerIdDocument: 'Owner ID',
  businessPermitDocument: 'Business Permit',
  taxPin: 'Tax PIN',
  proofOfAddressDocument: 'Proof of Address'
};

const statusColor = (status) => {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'success';
  if (status === 'PENDING_REVIEW') return 'warning';
  if (status === 'DOCUMENTS_REQUIRED') return 'error';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'default';
  return 'default';
};

const hasValue = (value) => {
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
};

const toHumanLabel = (key) => MISSING_LABELS[key] || key;

const openDocument = (value) => {
  if (!hasValue(value)) return;
  if (typeof value !== 'string') return;

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    window.open(value, '_blank', 'noopener,noreferrer');
    return;
  }

  navigator.clipboard.writeText(value).catch(() => {});
};

export default function ReviewDocuments() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingStoreId, setProcessingStoreId] = useState('');
  const [reasons, setReasons] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get('/api/stores');
      setStores(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to fetch stores for document review.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const reviewQueue = useMemo(() => {
    return stores
      .map((store) => {
        const missingDocuments = DOC_KEYS.filter((key) => !hasValue(store[key]));
        return {
          ...store,
          missingDocuments,
          hasAllDocs: missingDocuments.length === 0
        };
      })
      .filter((store) => {
        const status = String(store.status || '').toUpperCase();
        return status === 'PENDING_REVIEW' || status === 'DOCUMENTS_REQUIRED' || !store.hasAllDocs;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [stores]);

  const submitAction = async (storeId, action) => {
    try {
      setProcessingStoreId(storeId);
      setError('');
      setNotice('');

      const reason = (reasons[storeId] || '').trim();
      const payload = {
        action,
        reason: reason || undefined,
        requestedDocs: action === 'request_documents'
          ? ['owner_id_document', 'business_permit', 'tax_pin', 'payout_setup']
          : undefined
      };

      await apiClient.post(`/api/admin/stores/${storeId}/review`, payload);
      setNotice('Document review updated.');
      await fetchStores();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to submit review action.');
    } finally {
      setProcessingStoreId('');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Review Documents</Typography>
        <Button variant="outlined" onClick={fetchStores} disabled={loading}>Refresh</Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Review merchant onboarding documents and approve, request missing files, or reject submissions.
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : reviewQueue.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography>No stores currently require document review.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Store</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Documents</TableCell>
                <TableCell>Missing</TableCell>
                <TableCell>Review Note</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviewQueue.map((store) => (
                <TableRow key={store.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{store.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{store.owner?.email || 'No owner email'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor(store.status)} label={String(store.status || 'UNKNOWN').replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Button size="small" variant="text" disabled={!hasValue(store.ownerIdDocument)} onClick={() => openDocument(store.ownerIdDocument)}>Owner ID</Button>
                      <Button size="small" variant="text" disabled={!hasValue(store.businessPermitDocument)} onClick={() => openDocument(store.businessPermitDocument)}>Permit</Button>
                      <Button size="small" variant="text" disabled={!hasValue(store.proofOfAddressDocument)} onClick={() => openDocument(store.proofOfAddressDocument)}>Address Proof</Button>
                      <Button size="small" variant="text" disabled={!hasValue(store.taxPin)} onClick={() => openDocument(store.taxPin)}>Tax PIN</Button>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {store.missingDocuments.length === 0 ? (
                      <Chip size="small" color="success" label="Complete" />
                    ) : (
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {store.missingDocuments.map((key) => (
                          <Chip key={key} size="small" color="warning" label={toHumanLabel(key)} />
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Optional note"
                      value={reasons[store.id] || ''}
                      onChange={(e) => setReasons((prev) => ({ ...prev, [store.id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={processingStoreId === store.id}
                        onClick={() => submitAction(store.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={processingStoreId === store.id}
                        onClick={() => submitAction(store.id, 'request_documents')}
                      >
                        Request Docs
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={processingStoreId === store.id}
                        onClick={() => submitAction(store.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
