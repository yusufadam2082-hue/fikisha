import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SearchIcon from '@mui/icons-material/Search';
import CampaignIcon from '@mui/icons-material/Campaign';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import SortIcon from '@mui/icons-material/Sort';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fikisha-sut2.onrender.com';
const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const DEFAULT_COLOR = '#FF5A5F';
const COLOR_PRESETS = ['#FF5A5F', '#F97316', '#14B8A6', '#0EA5E9', '#0F172A'];

const emptyForm = {
  title: '',
  subtitle: '',
  ctaText: 'Order now',
  ctaLink: '',
  bgColor: DEFAULT_COLOR,
  image: '',
  active: true,
  startsAt: '',
  endsAt: '',
};

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIso(value) {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

function isValidHttpUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getStatus(promo) {
  const now = new Date();
  if (!promo.active) return 'inactive';
  const startsAt = promo.startsAt ? new Date(promo.startsAt) : null;
  const endsAt = promo.endsAt ? new Date(promo.endsAt) : null;
  if (startsAt && startsAt > now) return 'scheduled';
  if (endsAt && endsAt < now) return 'expired';
  return 'live';
}

function statusChip(status) {
  if (status === 'live') return { label: 'Live', color: 'success' };
  if (status === 'scheduled') return { label: 'Scheduled', color: 'info' };
  if (status === 'expired') return { label: 'Expired', color: 'error' };
  return { label: 'Inactive', color: 'default' };
}

export default function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' });

  const notify = (message, severity = 'success') => {
    setSnackbar({ open: true, severity, message });
  };

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/admin/promotions');
      setPromotions(res.data || []);
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to load promotions'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const stats = useMemo(() => {
    const counts = { total: promotions.length, live: 0, scheduled: 0, expired: 0, inactive: 0 };
    promotions.forEach((p) => {
      counts[getStatus(p)] += 1;
    });
    return counts;
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = promotions.filter((p) => {
      const status = getStatus(p);
      const matchesStatus = statusFilter === 'all' || statusFilter === status;
      const matchesSearch =
        !q ||
        p.title?.toLowerCase().includes(q) ||
        p.subtitle?.toLowerCase().includes(q) ||
        p.ctaText?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');

      const aStart = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bStart = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    });
  }, [promotions, search, statusFilter, sortBy]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      title: p.title || '',
      subtitle: p.subtitle || '',
      ctaText: p.ctaText || 'Order now',
      ctaLink: p.ctaLink || '',
      bgColor: p.bgColor || DEFAULT_COLOR,
      image: p.image || '',
      active: !!p.active,
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
    });
    setFormError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormError('');
  };

  const validateForm = () => {
    if (!form.title.trim() || !form.subtitle.trim()) {
      return 'Title and subtitle are required';
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test((form.bgColor || '').trim())) {
      return 'Background color must be in #RRGGBB format';
    }

    if (!isValidHttpUrl(form.ctaLink.trim())) {
      return 'Button link must start with http:// or https://';
    }

    const startsAt = toIso(form.startsAt);
    const endsAt = toIso(form.endsAt);

    if (form.startsAt && !startsAt) return 'Start date is invalid';
    if (form.endsAt && !endsAt) return 'End date is invalid';
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return 'End date must be after start date';
    }

    return '';
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      ctaText: form.ctaText.trim() || 'Order now',
      ctaLink: form.ctaLink.trim() || null,
      bgColor: form.bgColor.trim().toUpperCase(),
      image: form.image.trim() || null,
      active: form.active,
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt),
    };

    try {
      setSaving(true);
      if (editingId) {
        await apiClient.put(`/api/admin/promotions/${editingId}`, payload);
      } else {
        await apiClient.post('/api/admin/promotions', payload);
      }

      notify(editingId ? 'Promotion updated' : 'Promotion created');
      closeDialog();
      await fetchPromotions();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save promotion'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this promotion?')) return;

    try {
      await apiClient.delete(`/api/admin/promotions/${id}`);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      notify('Promotion deleted');
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to delete promotion'), 'error');
    }
  };

  const handleDuplicate = async (promo) => {
    try {
      const payload = {
        title: `${promo.title} (Copy)`,
        subtitle: promo.subtitle,
        ctaText: promo.ctaText || 'Order now',
        ctaLink: promo.ctaLink || null,
        bgColor: promo.bgColor || DEFAULT_COLOR,
        image: promo.image || null,
        active: false,
        startsAt: null,
        endsAt: null,
      };

      await apiClient.post('/api/admin/promotions', payload);
      notify('Promotion duplicated as draft');
      await fetchPromotions();
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to duplicate promotion'), 'error');
    }
  };

  const pauseAllLivePromotions = async () => {
    const livePromotions = promotions.filter((promo) => getStatus(promo) === 'live');
    if (!livePromotions.length) {
      notify('No live promotions to pause', 'info');
      return;
    }

    if (!window.confirm(`Pause ${livePromotions.length} live promotion(s)?`)) {
      return;
    }

    try {
      await Promise.all(livePromotions.map((promo) => apiClient.put(`/api/admin/promotions/${promo.id}`, { active: false })));
      notify('All live promotions paused');
      await fetchPromotions();
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to pause live promotions'), 'error');
    }
  };

  const toggleActive = async (promo) => {
    try {
      await apiClient.put(`/api/admin/promotions/${promo.id}`, { active: !promo.active });
      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? { ...p, active: !p.active } : p)));
      notify(!promo.active ? 'Promotion activated' : 'Promotion paused');
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to update promotion'), 'error');
    }
  };

  const previewStyle = {
    borderRadius: 3,
    p: 3,
    minHeight: 220,
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    background: form.image
      ? `linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.56)), url(${form.image}) center/cover`
      : `linear-gradient(135deg, ${form.bgColor || DEFAULT_COLOR} 0%, #0f172a 100%)`,
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Promotions</Typography>
          <Typography color="text.secondary">Manage homepage hero campaigns for customers.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Promotion
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined"><CardContent>
            <Stack direction="row" spacing={1} alignItems="center"><CampaignIcon color="primary" /><Typography>Total</Typography></Stack>
            <Typography variant="h5" fontWeight={700}>{stats.total}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined"><CardContent>
            <Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeIcon color="success" /><Typography>Live</Typography></Stack>
            <Typography variant="h5" fontWeight={700}>{stats.live}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined"><CardContent>
            <Stack direction="row" spacing={1} alignItems="center"><ScheduleIcon color="info" /><Typography>Scheduled</Typography></Stack>
            <Typography variant="h5" fontWeight={700}>{stats.scheduled}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined"><CardContent>
            <Stack direction="row" spacing={1} alignItems="center"><EventBusyIcon color="error" /><Typography>Expired/Off</Typography></Stack>
            <Typography variant="h5" fontWeight={700}>{stats.expired + stats.inactive}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={7}>
            <TextField
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, subtitle, CTA"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="live">Live</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Sort</InputLabel>
                <Select
                  label="Sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  startAdornment={<SortIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  <MenuItem value="newest">Newest first</MenuItem>
                  <MenuItem value="oldest">Oldest first</MenuItem>
                  <MenuItem value="title">Title A-Z</MenuItem>
                  <MenuItem value="startsSoon">Starts soon</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Grid>
        </Grid>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" size="small" startIcon={<PauseCircleOutlineIcon />} onClick={pauseAllLivePromotions}>
            Pause All Live
          </Button>
          <Button variant="outlined" size="small" onClick={() => { setSearch(''); setStatusFilter('all'); setSortBy('newest'); }}>
            Reset Filters
          </Button>
        </Stack>
      </Card>

      {loading ? (
        <Typography color="text.secondary">Loading promotions...</Typography>
      ) : filteredPromotions.length === 0 ? (
        <Card variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>No promotions found</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Create a campaign or change your filters.</Typography>
          <Button variant="outlined" onClick={() => { setSearch(''); setStatusFilter('all'); }}>Clear Filters</Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredPromotions.map((promo) => {
            const status = getStatus(promo);
            const chip = statusChip(status);

            return (
              <Grid item xs={12} md={6} lg={4} key={promo.id}>
                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box
                    sx={{
                      p: 2,
                      minHeight: 150,
                      color: '#fff',
                      background: promo.image
                        ? `linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.58)), url(${promo.image}) center/cover`
                        : `linear-gradient(135deg, ${promo.bgColor || DEFAULT_COLOR} 0%, #0f172a 100%)`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Chip size="small" label={chip.label} color={chip.color} />
                      <Chip size="small" label={promo.ctaText || 'Order now'} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
                    </Stack>
                    <Typography variant="h6" fontWeight={700}>{promo.title}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>{promo.subtitle}</Typography>
                  </Box>

                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Start: {promo.startsAt ? new Date(promo.startsAt).toLocaleString() : 'Any time'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      End: {promo.endsAt ? new Date(promo.endsAt).toLocaleString() : 'Any time'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Link: {promo.ctaLink || 'Scroll to store list'}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={promo.active ? <VisibilityOffIcon /> : <VisibilityIcon />} onClick={() => toggleActive(promo)}>
                        {promo.active ? 'Pause' : 'Activate'}
                      </Button>
                      <IconButton size="small" color="secondary" onClick={() => handleDuplicate(promo)} title="Duplicate">
                        <FileCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="primary" onClick={() => openEdit(promo)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(promo.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="lg">
        <DialogTitle>{editingId ? 'Edit Promotion' : 'New Promotion'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  fullWidth
                  required
                />
                <TextField
                  label="Subtitle"
                  value={form.subtitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  fullWidth
                  required
                  multiline
                  minRows={3}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Button Text"
                      value={form.ctaText}
                      onChange={(e) => setForm((prev) => ({ ...prev, ctaText: e.target.value }))}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Button Link"
                      value={form.ctaLink}
                      onChange={(e) => setForm((prev) => ({ ...prev, ctaLink: e.target.value }))}
                      fullWidth
                      type="url"
                      placeholder="Optional"
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Color"
                      value={form.bgColor}
                      onChange={(e) => setForm((prev) => ({ ...prev, bgColor: e.target.value.toUpperCase() }))}
                      fullWidth
                      placeholder="#FF5A5F"
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      label="Background Image URL"
                      value={form.image}
                      onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                      fullWidth
                      type="url"
                    />
                  </Grid>
                </Grid>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {COLOR_PRESETS.map((color) => (
                    <Box
                      key={color}
                      onClick={() => setForm((prev) => ({ ...prev, bgColor: color }))}
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: color,
                        cursor: 'pointer',
                        border: form.bgColor === color ? '3px solid #111827' : '2px solid #fff',
                        boxShadow: 1,
                      }}
                    />
                  ))}
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Start"
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="End"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
                <FormControlLabel
                  control={<Switch checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />}
                  label="Visible to customers"
                />

                <Typography variant="caption" color="text.secondary">
                  Title: {form.title.length}/90 chars | Subtitle: {form.subtitle.length}/160 chars
                </Typography>

                {formError ? <Alert severity="error">{formError}</Alert> : null}
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Preview
              </Typography>
              <Box sx={previewStyle}>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>{form.title || 'Promotion title'}</Typography>
                <Typography variant="body1" sx={{ opacity: 0.92, mb: 2 }}>{form.subtitle || 'Promotion subtitle preview'}</Typography>
                <Button variant="contained" sx={{ alignSelf: 'flex-start' }}>
                  {form.ctaText || 'Order now'}
                </Button>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Status preview: <b>{statusChip(getStatus({ ...form, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt) })).label}</b>
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Promotion'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
