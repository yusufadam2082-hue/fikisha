import React, { useEffect, useMemo, useState } from 'react';
import {
  Chip,
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaceIcon from '@mui/icons-material/Place';
import NavigationIcon from '@mui/icons-material/Navigation';
import EditIcon from '@mui/icons-material/Edit';
import apiClient from '../utils/apiClient';
import { formatKES } from '../utils/currency';
import { appendStoreSecurityEvent } from '../utils/storeSecurityLog';

const ONBOARDING_DRAFT_KEY = 'admin_store_onboarding_draft_v2';

const STEPS = [
  'Account Information',
  'Store Information',
  'Store Location',
  'Operating & Delivery Setup',
  'Verification & Compliance',
  'Payout Setup',
  'Legal & Submission'
];

const STORE_CATEGORIES = ['grocery', 'restaurant', 'pharmacy', 'electronics', 'fashion', 'beauty', 'hardware', 'other'];
const DELIVERY_METHODS = ['PLATFORM_DRIVERS', 'OWN_RIDERS', 'BOTH'];
const DELIVERY_FEE_TYPES = ['FIXED', 'DISTANCE_BASED', 'FREE_OVER_THRESHOLD'];
const PAYOUT_METHODS = ['BANK', 'MPESA', 'WALLET'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const createDefaultOpeningHours = () => DAY_KEYS.reduce((acc, day) => {
  acc[day] = { open: '08:00', close: '21:00', closed: false };
  return acc;
}, {});

const createDraft = () => ({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  name: '',
  category: '',
  description: '',
  image: '',
  bannerImage: '',
  country: '',
  city: '',
  area: '',
  streetAddress: '',
  buildingNumber: '',
  landmark: '',
  address: '',
  latitude: '',
  longitude: '',
  deliveryRadiusKm: 3,
  openingHours: createDefaultOpeningHours(),
  orderPreparationTimeMin: 25,
  minimumOrderAmount: 0,
  deliveryMethod: 'PLATFORM_DRIVERS',
  deliveryFeeType: 'FIXED',
  deliveryFeeValue: 200,
  freeDeliveryThreshold: 0,
  allowPickup: true,
  ownerIdDocument: '',
  businessPermitDocument: '',
  taxPin: '',
  proofOfAddressDocument: '',
  payoutMethod: 'MPESA',
  bankName: '',
  accountName: '',
  accountNumber: '',
  mpesaNumber: '',
  mpesaRegisteredName: '',
  acceptedTerms: false,
  acceptedPrivacy: false,
  confirmedAccurate: false,
  confirmedAuthorization: false
});

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const parseOpeningHours = (store) => {
  if (store?.openingHours && typeof store.openingHours === 'object') {
    return store.openingHours;
  }

  if (typeof store?.operatingHours === 'string' && store.operatingHours.trim()) {
    try {
      const parsed = JSON.parse(store.operatingHours);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      return createDefaultOpeningHours();
    }
  }

  return createDefaultOpeningHours();
};

const createEditDraftFromStore = (store = {}) => ({
  id: store.id,
  name: store.name || '',
  category: store.category || '',
  description: store.description || '',
  image: store.image || '',
  bannerImage: store.bannerImage || '',
  address: store.address || '',
  country: store.country || '',
  city: store.city || '',
  area: store.area || '',
  streetAddress: store.streetAddress || '',
  buildingNumber: store.buildingNumber || '',
  landmark: store.landmark || '',
  latitude: store.latitude ?? '',
  longitude: store.longitude ?? '',
  deliveryRadiusKm: store.deliveryRadiusKm ?? 3,
  openingHours: parseOpeningHours(store),
  orderPreparationTimeMin: store.orderPreparationTimeMin ?? 25,
  minimumOrderAmount: store.minimumOrderAmount ?? 0,
  deliveryMethod: store.deliveryMethod || 'PLATFORM_DRIVERS',
  deliveryFeeType: store.deliveryFeeType || 'FIXED',
  deliveryFeeValue: store.deliveryFeeValue ?? 0,
  freeDeliveryThreshold: store.freeDeliveryThreshold ?? 0,
  allowPickup: Boolean(store.allowPickup),
  phone: store.phone || '',
  ownerIdDocument: store.ownerIdDocument || '',
  businessPermitDocument: store.businessPermitDocument || '',
  taxPin: store.taxPin || '',
  proofOfAddressDocument: store.proofOfAddressDocument || '',
  payoutMethod: store.payoutMethod || 'MPESA',
  bankName: store.bankName || '',
  accountName: store.accountName || '',
  accountNumber: store.accountNumber || '',
  mpesaNumber: store.mpesaNumber || '',
  mpesaRegisteredName: store.mpesaRegisteredName || '',
  reviewNotes: store.reviewNotes || ''
});

function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [draft, setDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return createDraft();
      return { ...createDraft(), ...JSON.parse(raw) };
    } catch {
      return createDraft();
    }
  });
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [reviewReason, setReviewReason] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [manageCredentialsOpen, setManageCredentialsOpen] = useState(false);
  const [credentialsStoreId, setCredentialsStoreId] = useState('');
  const [credentialsStoreName, setCredentialsStoreName] = useState('');
  const [credentialsName, setCredentialsName] = useState('');
  const [credentialsUsername, setCredentialsUsername] = useState('');
  const [credentialsEmail, setCredentialsEmail] = useState('');
  const [credentialsPhone, setCredentialsPhone] = useState('');
  const [credentialsPassword, setCredentialsPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState({
    storeName: '',
    ownerName: '',
    username: '',
    password: ''
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchStores();
  }, []);

  const getApiErrorMessage = (err, fallback) => {
    const status = err?.response?.status;
    const apiMessage = err?.response?.data?.error || err?.response?.data?.message;
    const localMessage = err?.message;

    if (status === 401) {
      return `Unauthorized (401): ${apiMessage || 'Please log in again.'}`;
    }

    if (status === 403) {
      return `Forbidden (403): ${apiMessage || 'You do not have permission for this action.'}`;
    }

    if (status && apiMessage) {
      return `${apiMessage} (${status})`;
    }

    return localMessage || fallback;
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return {};
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      getAuthConfig();
      const res = await apiClient.get('/api/stores');
      setStores(res.data);
    } catch (err) {
      console.error('Failed to fetch stores', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  }, [draft, open]);

  const handleOpen = () => {
    setOpen(true);
    setError('');
  };

  const resetWizard = () => {
    setDraft(createDraft());
    setOnboardingStep(1);
    setLocationSearch('');
    setLocationResults([]);
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  };

  const handleClose = () => {
    setOpen(false);
    setError('');
  };

  const handleOpenEdit = (store) => {
    setEditingStore(createEditDraftFromStore(store));
    setEditOpen(true);
    setError('');
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditingStore(null);
    setError('');
  };

  const mapCenter = useMemo(() => {
    const lat = Number(draft.latitude);
    const lng = Number(draft.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return { lat: -6.7924, lng: 39.2083 };
  }, [draft.latitude, draft.longitude]);

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 0.02}%2C${mapCenter.lat - 0.02}%2C${mapCenter.lng + 0.02}%2C${mapCenter.lat + 0.02}&layer=mapnik&marker=${mapCenter.lat}%2C${mapCenter.lng}`;

  const validateStep = (step) => {
    if (step === 1) {
      if (!draft.fullName || !draft.email || !draft.phone || !draft.password || !draft.confirmPassword) {
        return 'Fill all account information fields.';
      }
      if (draft.password.length < 6) {
        return 'Password must be at least 6 characters.';
      }
      if (draft.password !== draft.confirmPassword) {
        return 'Passwords do not match.';
      }
      if (!/^\+[1-9]\d{7,14}$/.test(String(draft.phone).replace(/[\s\-()]/g, ''))) {
        return 'Phone number must be in international format (e.g. +255700000000).';
      }
    }

    if (step === 2) {
      if (!draft.name || !draft.category || !draft.description || !draft.image) {
        return 'Store name, category, description, and logo are required.';
      }
    }

    if (step === 3) {
      if (!draft.country || !draft.city || !draft.area || !draft.streetAddress) {
        return 'Country, city/town, area, and street address are required.';
      }
      if (draft.latitude === '' || draft.longitude === '') {
        return 'Save latitude and longitude using map/search/auto-detect.';
      }
      if (!Number(draft.deliveryRadiusKm) || Number(draft.deliveryRadiusKm) <= 0) {
        return 'Delivery radius in KM is required.';
      }
    }

    if (step === 4) {
      if (!Number(draft.orderPreparationTimeMin) || Number(draft.orderPreparationTimeMin) < 1) {
        return 'Order preparation time is required.';
      }
      if (!draft.deliveryMethod || !draft.deliveryFeeType) {
        return 'Delivery setup is incomplete.';
      }
    }

    if (step === 7) {
      if (!draft.acceptedTerms || !draft.acceptedPrivacy || !draft.confirmedAccurate || !draft.confirmedAuthorization) {
        return 'You must accept all legal confirmations before submission.';
      }
    }

    return null;
  };

  const handleNext = () => {
    const validationError = validateStep(onboardingStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setOnboardingStep((prev) => Math.min(7, prev + 1));
  };

  const handleBack = () => {
    setError('');
    setOnboardingStep((prev) => Math.max(1, prev - 1));
  };

  const handleUpload = async (file, target) => {
    if (!file) return;
    try {
      const encoded = await toBase64(file);
      setDraft((prev) => ({ ...prev, [target]: encoded }));
    } catch {
      setError('Failed to process selected file.');
    }
  };

  const handleSearchAddress = async () => {
    if (!locationSearch.trim()) {
      setLocationResults([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const encoded = encodeURIComponent(locationSearch.trim());
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=6&addressdetails=1`, {
        headers: { 'User-Agent': 'FikishaAdminPortal/1.0' }
      });
      if (!response.ok) {
        throw new Error('Address lookup failed');
      }
      const data = await response.json();
      setLocationResults(Array.isArray(data) ? data : []);
    } catch {
      setLocationResults([]);
      setError('Address search failed. Please try again.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this browser.');
      return;
    }

    setIsDetectingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setDraft((prev) => ({ ...prev, latitude: lat, longitude: lng }));

      try {
        const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
          headers: { 'User-Agent': 'FikishaAdminPortal/1.0' }
        });

        if (reverseRes.ok) {
          const reverseData = await reverseRes.json();
          setDraft((prev) => ({
            ...prev,
            address: reverseData.display_name || prev.address,
            country: reverseData.address?.country || prev.country,
            city: reverseData.address?.city || reverseData.address?.town || reverseData.address?.village || prev.city,
            area: reverseData.address?.suburb || reverseData.address?.neighbourhood || prev.area,
            streetAddress: reverseData.address?.road || prev.streetAddress,
            landmark: reverseData.address?.amenity || prev.landmark
          }));
        }
      } catch {
        // Keep coordinates even if reverse geocoding fails.
      } finally {
        setIsDetectingLocation(false);
      }
    }, () => {
      setIsDetectingLocation(false);
      setError('Could not detect current location.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };

  const handleCloseCredentialsDialog = () => {
    setCredentialsDialogOpen(false);
  };

  const openCredentialsEditor = (store) => {
    setCredentialsStoreId(store.id);
    setCredentialsStoreName(store.name);
    setCredentialsName(store.owner?.name || '');
    setCredentialsUsername(store.owner?.username || '');
    setCredentialsEmail(store.owner?.email || '');
    setCredentialsPhone(store.owner?.phone || '');
    setCredentialsPassword('');
    setManageCredentialsOpen(true);
  };

  const handleCloseCredentialsEditor = () => {
    setManageCredentialsOpen(false);
  };

  const handleCopyText = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setSnackbarMessage(`${label} copied`);
      setSnackbarSeverity('success');
    } catch {
      setSnackbarMessage(`Failed to copy ${label.toLowerCase()}`);
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const validationError = [1, 2, 3, 4, 7].map(validateStep).find(Boolean);
      if (validationError) {
        throw new Error(validationError);
      }

      setIsSubmitting(true);

      getAuthConfig();
      const createRes = await apiClient.post('/api/stores', {
        ...draft,
        ownerName: draft.fullName,
        ownerEmail: draft.email,
        ownerPhone: draft.phone,
        ownerPassword: draft.password,
        onboardingCompleted: true,
        status: 'PENDING_REVIEW'
      });

      setCreatedCredentials({
        storeName: createRes.data?.name || draft.name,
        ownerName: createRes.data?.owner?.name || draft.fullName,
        username: createRes.data?.owner?.username || '',
        password: draft.password
      });

      appendStoreSecurityEvent({
        storeId: createRes.data?.id,
        type: 'STORE_CREATED',
        message: `Store ${createRes.data?.name || draft.name} created`,
        metadata: {
          ownerUsername: createRes.data?.owner?.username || ''
        }
      });

      setCredentialsDialogOpen(true);
      setSnackbarMessage('Store created successfully!');
      setSnackbarSeverity('success');
      handleClose();
      resetWizard();
      await fetchStores();
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to save store');
      setError(message);
      setSnackbarMessage(message);
      setSnackbarSeverity('error');
    } finally {
      setIsSubmitting(false);
      setSnackbarOpen(true);
    }
  };

  const handleStoreReviewAction = async (storeId, action) => {
    try {
      getAuthConfig();
      await apiClient.post(`/api/admin/stores/${storeId}/review`, {
        action,
        reason: reviewReason[storeId] || undefined,
        requestedDocs: action === 'request_documents' ? ['owner_id_document', 'business_permit', 'tax_pin', 'payout_setup'] : undefined
      });
      setSnackbarMessage('Store review action saved');
      setSnackbarSeverity('success');
      await fetchStores();
    } catch (err) {
      setSnackbarMessage(getApiErrorMessage(err, 'Failed to process review action'));
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const getStatusChip = (store) => {
    const status = String(store.status || '').toUpperCase();
    if (status === 'PENDING_REVIEW') return <Chip size="small" label="Pending Review" color="warning" />;
    if (status === 'DOCUMENTS_REQUIRED') return <Chip size="small" label="Docs Required" color="error" />;
    if (status === 'APPROVED') return <Chip size="small" label="Approved" color="info" />;
    if (status === 'ACTIVE') return <Chip size="small" label="Active" color="success" />;
    if (status === 'SUSPENDED') return <Chip size="small" label="Suspended" color="error" />;
    if (status === 'REJECTED') return <Chip size="small" label="Rejected" color="default" />;
    return <Chip size="small" label={store.isOpen === false ? 'Closed' : 'Open'} />;
  };

  const handleToggleStoreStatus = async (store) => {
    const nextIsOpen = store.isOpen === false;

    try {
      getAuthConfig();
      await apiClient.put(`/api/stores/${store.id}`, { isOpen: nextIsOpen });

      appendStoreSecurityEvent({
        storeId: store.id,
        type: nextIsOpen ? 'STORE_OPENED' : 'STORE_CLOSED',
        message: nextIsOpen ? `Store ${store.name} opened` : `Store ${store.name} closed`,
        metadata: {
          previous: store.isOpen === false ? 'closed' : 'open',
          current: nextIsOpen ? 'open' : 'closed'
        }
      });

      setSnackbarMessage(nextIsOpen ? 'Store opened successfully' : 'Store closed successfully');
      setSnackbarSeverity('success');
      await fetchStores();
    } catch (err) {
      setSnackbarMessage(getApiErrorMessage(err, 'Failed to update store status'));
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!credentialsStoreId) {
      return;
    }

    try {
      const payload = {
        ownerName: credentialsName,
        ownerUsername: credentialsUsername,
        ownerEmail: credentialsEmail || null,
        ownerPhone: credentialsPhone || null
      };

      if (credentialsPassword.trim()) {
        payload.ownerPassword = credentialsPassword.trim();
      }

      getAuthConfig();
      await apiClient.put(`/api/stores/${credentialsStoreId}/credentials`, payload);

      appendStoreSecurityEvent({
        storeId: credentialsStoreId,
        type: 'MERCHANT_CREDENTIALS_UPDATED',
        message: `Credentials updated for ${credentialsUsername}`,
        metadata: {
          ownerUsername: credentialsUsername,
          passwordChanged: Boolean(credentialsPassword.trim())
        }
      });

      setManageCredentialsOpen(false);
      setSnackbarMessage('Merchant credentials updated successfully');
      setSnackbarSeverity('success');
      await fetchStores();
    } catch (err) {
      setSnackbarMessage(getApiErrorMessage(err, 'Failed to update merchant credentials'));
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleSaveStoreInfo = async () => {
    if (!editingStore?.id) {
      return;
    }

    try {
      setIsSavingEdit(true);
      setError('');
      getAuthConfig();
      await apiClient.put(`/api/stores/${editingStore.id}`, {
        name: editingStore.name,
        category: editingStore.category,
        description: editingStore.description,
        image: editingStore.image,
        bannerImage: editingStore.bannerImage,
        address: editingStore.address,
        country: editingStore.country,
        city: editingStore.city,
        area: editingStore.area,
        streetAddress: editingStore.streetAddress,
        buildingNumber: editingStore.buildingNumber,
        landmark: editingStore.landmark,
        latitude: editingStore.latitude === '' ? null : Number(editingStore.latitude),
        longitude: editingStore.longitude === '' ? null : Number(editingStore.longitude),
        deliveryRadiusKm: Number(editingStore.deliveryRadiusKm) || 0,
        openingHours: editingStore.openingHours,
        orderPreparationTimeMin: Number(editingStore.orderPreparationTimeMin) || 0,
        minimumOrderAmount: Number(editingStore.minimumOrderAmount) || 0,
        deliveryMethod: editingStore.deliveryMethod,
        deliveryFeeType: editingStore.deliveryFeeType,
        deliveryFeeValue: Number(editingStore.deliveryFeeValue) || 0,
        freeDeliveryThreshold: Number(editingStore.freeDeliveryThreshold) || 0,
        allowPickup: Boolean(editingStore.allowPickup),
        phone: editingStore.phone,
        ownerIdDocument: editingStore.ownerIdDocument,
        businessPermitDocument: editingStore.businessPermitDocument,
        taxPin: editingStore.taxPin,
        proofOfAddressDocument: editingStore.proofOfAddressDocument,
        payoutMethod: editingStore.payoutMethod,
        bankName: editingStore.bankName,
        accountName: editingStore.accountName,
        accountNumber: editingStore.accountNumber,
        mpesaNumber: editingStore.mpesaNumber,
        mpesaRegisteredName: editingStore.mpesaRegisteredName,
        reviewNotes: editingStore.reviewNotes
      });

      setSnackbarMessage('Store information updated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      handleCloseEdit();
      await fetchStores();
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to update store information');
      setError(message);
      setSnackbarMessage(message);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsSavingEdit(false);
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
        <Typography variant="h4">Stores Management</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpen}>
          Add Store
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {stores.length === 0 ? (
            <Typography color="text.secondary">No stores found</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Rating</TableCell>
                    <TableCell>Delivery Fee</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>{store.name}</TableCell>
                      <TableCell>{store.category}</TableCell>
                      <TableCell>{getStatusChip(store)}</TableCell>
                      <TableCell>{store.rating}</TableCell>
                      <TableCell>{formatKES(Number(store.deliveryFee || 0))}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'grid', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<PowerSettingsNewIcon />}
                              color={store.isOpen === false ? 'success' : 'warning'}
                              onClick={() => handleToggleStoreStatus(store)}
                            >
                              {store.isOpen === false ? 'Open' : 'Close'}
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<LockResetIcon />} onClick={() => openCredentialsEditor(store)}>
                              Credentials
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleOpenEdit(store)}>
                              View / Update
                            </Button>
                          </Box>

                          <TextField
                            size="small"
                            placeholder="Review reason (optional)"
                            value={reviewReason[store.id] || ''}
                            onChange={(e) => setReviewReason((prev) => ({ ...prev, [store.id]: e.target.value }))}
                          />

                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button size="small" variant="outlined" onClick={() => handleStoreReviewAction(store.id, 'approve')}>Approve</Button>
                            <Button size="small" variant="outlined" color="warning" onClick={() => handleStoreReviewAction(store.id, 'request_documents')}>Request Docs</Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => handleStoreReviewAction(store.id, 'reject')}>Reject</Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => handleStoreReviewAction(store.id, 'suspend')}>Suspend</Button>
                            <Button size="small" variant="outlined" color="success" onClick={() => handleStoreReviewAction(store.id, 'activate')}>Activate</Button>
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>Store Onboarding Wizard</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Step {onboardingStep} of 7. Draft auto-saves while you work.
            </Typography>
            <LinearProgress variant="determinate" value={(onboardingStep / 7) * 100} sx={{ mb: 2, height: 8, borderRadius: 2 }} />
            <Stepper activeStep={onboardingStep - 1} alternativeLabel sx={{ mb: 3, display: { xs: 'none', md: 'flex' } }}>
              {STEPS.map((label) => (
                <Step key={label}><StepLabel>{label}</StepLabel></Step>
              ))}
            </Stepper>

            {onboardingStep === 1 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 1: Account Information</Typography></Grid>
                <Grid item xs={12} md={6}><TextField label="Full Name" value={draft.fullName} onChange={(e) => setDraft((prev) => ({ ...prev, fullName: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={6}><TextField label="Email Address" type="email" value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={4}><TextField label="Phone Number (+255...)" value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={4}><TextField label="Password" type="password" value={draft.password} onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={4}><TextField label="Confirm Password" type="password" value={draft.confirmPassword} onChange={(e) => setDraft((prev) => ({ ...prev, confirmPassword: e.target.value }))} fullWidth required /></Grid>
              </Grid>
            )}

            {onboardingStep === 2 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 2: Store Information</Typography></Grid>
                <Grid item xs={12} md={6}><TextField label="Store Name" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <Select value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))} displayEmpty>
                      <MenuItem value="">Select Category</MenuItem>
                      {STORE_CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}><TextField label="Store Description" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} fullWidth multiline rows={3} required /></Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" sx={{ mb: 1 }}>Store Logo (required)</Typography>
                  <Button component="label" variant="outlined" fullWidth>Upload Logo<input hidden type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0], 'image')} /></Button>
                  {draft.image ? <Typography variant="caption" color="success.main">Logo uploaded</Typography> : null}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" sx={{ mb: 1 }}>Store Banner (optional)</Typography>
                  <Button component="label" variant="outlined" fullWidth>Upload Banner<input hidden type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0], 'bannerImage')} /></Button>
                  {draft.bannerImage ? <Typography variant="caption" color="success.main">Banner uploaded</Typography> : null}
                </Grid>
              </Grid>
            )}

            {onboardingStep === 3 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 3: Store Location</Typography></Grid>
                <Grid item xs={12} md={4}><TextField label="Country" value={draft.country} onChange={(e) => setDraft((prev) => ({ ...prev, country: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={4}><TextField label="City / Town" value={draft.city} onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={4}><TextField label="Area / Neighborhood" value={draft.area} onChange={(e) => setDraft((prev) => ({ ...prev, area: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={6}><TextField label="Street Address" value={draft.streetAddress} onChange={(e) => setDraft((prev) => ({ ...prev, streetAddress: e.target.value }))} fullWidth required /></Grid>
                <Grid item xs={12} md={3}><TextField label="Building / Shop Number" value={draft.buildingNumber} onChange={(e) => setDraft((prev) => ({ ...prev, buildingNumber: e.target.value }))} fullWidth /></Grid>
                <Grid item xs={12} md={3}><TextField label="Landmark" value={draft.landmark} onChange={(e) => setDraft((prev) => ({ ...prev, landmark: e.target.value }))} fullWidth /></Grid>

                <Grid item xs={12} md={8}><TextField label="Manual address search" value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} fullWidth /></Grid>
                <Grid item xs={6} md={2}><Button variant="outlined" fullWidth onClick={handleSearchAddress}>{isSearchingLocation ? 'Searching...' : 'Search'}</Button></Grid>
                <Grid item xs={6} md={2}><Button variant="outlined" fullWidth onClick={handleUseCurrentLocation} startIcon={<NavigationIcon />}>{isDetectingLocation ? 'Locating...' : 'Use Device'}</Button></Grid>

                {locationResults.length > 0 && (
                  <Grid item xs={12}>
                    <Box sx={{ border: '1px solid #ddd', borderRadius: 1, maxHeight: 180, overflowY: 'auto' }}>
                      {locationResults.map((result, idx) => (
                        <Box
                          key={`${result.lat}-${result.lon}-${idx}`}
                          onClick={() => setDraft((prev) => ({
                            ...prev,
                            latitude: Number(result.lat),
                            longitude: Number(result.lon),
                            address: result.display_name || prev.address
                          }))}
                          sx={{ p: 1.25, cursor: 'pointer', borderBottom: idx < locationResults.length - 1 ? '1px solid #eee' : 'none' }}
                        >
                          <Typography variant="body2">{result.display_name}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12} md={3}><TextField label="Latitude" type="number" value={draft.latitude} onChange={(e) => setDraft((prev) => ({ ...prev, latitude: e.target.value }))} fullWidth /></Grid>
                <Grid item xs={12} md={3}><TextField label="Longitude" type="number" value={draft.longitude} onChange={(e) => setDraft((prev) => ({ ...prev, longitude: e.target.value }))} fullWidth /></Grid>
                <Grid item xs={12} md={3}><TextField label="Delivery Radius (KM)" type="number" value={draft.deliveryRadiusKm} onChange={(e) => setDraft((prev) => ({ ...prev, deliveryRadiusKm: Number(e.target.value) || 0 }))} fullWidth required /></Grid>
                <Grid item xs={12} md={3}><Button variant="outlined" fullWidth startIcon={<PlaceIcon />} onClick={() => setMapPickerOpen(true)}>Map Picker</Button></Grid>

                <Grid item xs={12}>
                  <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden', height: 260 }}>
                    <iframe title="Store map preview" src={mapSrc} width="100%" height="100%" style={{ border: 'none' }} />
                  </Box>
                </Grid>
              </Grid>
            )}

            {onboardingStep === 4 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 4: Operating & Delivery Setup</Typography></Grid>
                <Grid item xs={12}><Typography variant="subtitle2">Opening hours (daily schedule)</Typography></Grid>
                {DAY_KEYS.map((day) => (
                  <React.Fragment key={day}>
                    <Grid item xs={12} md={2}><Typography sx={{ textTransform: 'capitalize', pt: 1 }}>{day}</Typography></Grid>
                    <Grid item xs={5} md={3}><TextField type="time" fullWidth value={draft.openingHours?.[day]?.open || '08:00'} disabled={Boolean(draft.openingHours?.[day]?.closed)} onChange={(e) => setDraft((prev) => ({ ...prev, openingHours: { ...(prev.openingHours || {}), [day]: { ...(prev.openingHours?.[day] || {}), open: e.target.value, close: prev.openingHours?.[day]?.close || '21:00', closed: Boolean(prev.openingHours?.[day]?.closed) } } }))} /></Grid>
                    <Grid item xs={5} md={3}><TextField type="time" fullWidth value={draft.openingHours?.[day]?.close || '21:00'} disabled={Boolean(draft.openingHours?.[day]?.closed)} onChange={(e) => setDraft((prev) => ({ ...prev, openingHours: { ...(prev.openingHours || {}), [day]: { ...(prev.openingHours?.[day] || {}), close: e.target.value, open: prev.openingHours?.[day]?.open || '08:00', closed: Boolean(prev.openingHours?.[day]?.closed) } } }))} /></Grid>
                    <Grid item xs={2} md={4}><FormControlLabel control={<Checkbox checked={Boolean(draft.openingHours?.[day]?.closed)} onChange={(e) => setDraft((prev) => ({ ...prev, openingHours: { ...(prev.openingHours || {}), [day]: { ...(prev.openingHours?.[day] || {}), open: prev.openingHours?.[day]?.open || '08:00', close: prev.openingHours?.[day]?.close || '21:00', closed: e.target.checked } } }))} />} label="Closed" /></Grid>
                  </React.Fragment>
                ))}

                <Grid item xs={12} md={4}><TextField label="Order preparation time (minutes)" type="number" value={draft.orderPreparationTimeMin} onChange={(e) => setDraft((prev) => ({ ...prev, orderPreparationTimeMin: Number(e.target.value) || 0 }))} fullWidth required /></Grid>
                <Grid item xs={12} md={4}><TextField label="Minimum order amount" type="number" value={draft.minimumOrderAmount} onChange={(e) => setDraft((prev) => ({ ...prev, minimumOrderAmount: Number(e.target.value) || 0 }))} fullWidth /></Grid>
                <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={Boolean(draft.allowPickup)} onChange={(e) => setDraft((prev) => ({ ...prev, allowPickup: e.target.checked }))} />} label="Allow pickup from store" /></Grid>

                <Grid item xs={12} md={4}><FormControl fullWidth><Select value={draft.deliveryMethod} onChange={(e) => setDraft((prev) => ({ ...prev, deliveryMethod: e.target.value }))}>{DELIVERY_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} md={4}><FormControl fullWidth><Select value={draft.deliveryFeeType} onChange={(e) => setDraft((prev) => ({ ...prev, deliveryFeeType: e.target.value }))}>{DELIVERY_FEE_TYPES.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} md={4}><TextField label="Delivery fee value" type="number" value={draft.deliveryFeeValue} onChange={(e) => setDraft((prev) => ({ ...prev, deliveryFeeValue: Number(e.target.value) || 0 }))} fullWidth /></Grid>
                <Grid item xs={12} md={4}><TextField label="Free delivery threshold" type="number" value={draft.freeDeliveryThreshold} onChange={(e) => setDraft((prev) => ({ ...prev, freeDeliveryThreshold: Number(e.target.value) || 0 }))} fullWidth /></Grid>
              </Grid>
            )}

            {onboardingStep === 5 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 5: Verification & Compliance</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">These can be completed later before approval/go-live.</Typography></Grid>
                <Grid item xs={12} md={6}><Button component="label" variant="outlined" fullWidth>Owner National ID / Passport<input hidden type="file" accept="image/*,.pdf" onChange={(e) => handleUpload(e.target.files?.[0], 'ownerIdDocument')} /></Button>{draft.ownerIdDocument ? <Typography variant="caption" color="success.main">Uploaded</Typography> : null}</Grid>
                <Grid item xs={12} md={6}><Button component="label" variant="outlined" fullWidth>Business Permit / License<input hidden type="file" accept="image/*,.pdf" onChange={(e) => handleUpload(e.target.files?.[0], 'businessPermitDocument')} /></Button>{draft.businessPermitDocument ? <Typography variant="caption" color="success.main">Uploaded</Typography> : null}</Grid>
                <Grid item xs={12} md={6}><TextField label="Tax/KRA PIN" value={draft.taxPin} onChange={(e) => setDraft((prev) => ({ ...prev, taxPin: e.target.value }))} fullWidth /></Grid>
                <Grid item xs={12} md={6}><Button component="label" variant="outlined" fullWidth>Proof of Address (optional)<input hidden type="file" accept="image/*,.pdf" onChange={(e) => handleUpload(e.target.files?.[0], 'proofOfAddressDocument')} /></Button>{draft.proofOfAddressDocument ? <Typography variant="caption" color="success.main">Uploaded</Typography> : null}</Grid>
              </Grid>
            )}

            {onboardingStep === 6 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 6: Payout Setup</Typography></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">This can be completed later before approval/go-live.</Typography></Grid>
                <Grid item xs={12} md={4}><FormControl fullWidth><Select value={draft.payoutMethod} onChange={(e) => setDraft((prev) => ({ ...prev, payoutMethod: e.target.value }))}>{PAYOUT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl></Grid>
                {draft.payoutMethod === 'BANK' && (
                  <>
                    <Grid item xs={12} md={4}><TextField label="Bank name" value={draft.bankName} onChange={(e) => setDraft((prev) => ({ ...prev, bankName: e.target.value }))} fullWidth /></Grid>
                    <Grid item xs={12} md={4}><TextField label="Account name" value={draft.accountName} onChange={(e) => setDraft((prev) => ({ ...prev, accountName: e.target.value }))} fullWidth /></Grid>
                    <Grid item xs={12} md={4}><TextField label="Account number" value={draft.accountNumber} onChange={(e) => setDraft((prev) => ({ ...prev, accountNumber: e.target.value }))} fullWidth /></Grid>
                  </>
                )}
                {draft.payoutMethod === 'MPESA' && (
                  <>
                    <Grid item xs={12} md={4}><TextField label="M-Pesa number" value={draft.mpesaNumber} onChange={(e) => setDraft((prev) => ({ ...prev, mpesaNumber: e.target.value }))} fullWidth /></Grid>
                    <Grid item xs={12} md={4}><TextField label="M-Pesa registered name" value={draft.mpesaRegisteredName} onChange={(e) => setDraft((prev) => ({ ...prev, mpesaRegisteredName: e.target.value }))} fullWidth /></Grid>
                  </>
                )}
              </Grid>
            )}

            {onboardingStep === 7 && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="h6">Step 7: Legal & Submission</Typography></Grid>
                <Grid item xs={12}><FormControlLabel control={<Checkbox checked={Boolean(draft.acceptedTerms)} onChange={(e) => setDraft((prev) => ({ ...prev, acceptedTerms: e.target.checked }))} />} label="Accept Terms & Conditions" /></Grid>
                <Grid item xs={12}><FormControlLabel control={<Checkbox checked={Boolean(draft.acceptedPrivacy)} onChange={(e) => setDraft((prev) => ({ ...prev, acceptedPrivacy: e.target.checked }))} />} label="Accept Privacy Policy" /></Grid>
                <Grid item xs={12}><FormControlLabel control={<Checkbox checked={Boolean(draft.confirmedAccurate)} onChange={(e) => setDraft((prev) => ({ ...prev, confirmedAccurate: e.target.checked }))} />} label="Confirm information is accurate" /></Grid>
                <Grid item xs={12}><FormControlLabel control={<Checkbox checked={Boolean(draft.confirmedAuthorization)} onChange={(e) => setDraft((prev) => ({ ...prev, confirmedAuthorization: e.target.checked }))} />} label="Confirm authorization to register the business" /></Grid>
                <Grid item xs={12}>
                  <Alert severity="info">Store will be created as Pending Review. Verification and payout can be completed later before approval/go-live.</Alert>
                </Grid>
              </Grid>
            )}

            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft)); handleClose(); }}>Save Draft & Close</Button>
          <Button onClick={resetWizard} color="inherit">Start New</Button>
          <Button onClick={handleBack} disabled={onboardingStep === 1}>Back</Button>
          {onboardingStep < 7 ? (
            <Button variant="contained" onClick={handleNext}>Next</Button>
          ) : (
            <Button variant="contained" color="primary" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit For Review'}</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={mapPickerOpen} onClose={() => setMapPickerOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Map Location Picker</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use search/auto-detect to prefill coordinates, then fine-tune latitude/longitude here.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}><TextField label="Latitude" type="number" value={draft.latitude} onChange={(e) => setDraft((prev) => ({ ...prev, latitude: e.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Longitude" type="number" value={draft.longitude} onChange={(e) => setDraft((prev) => ({ ...prev, longitude: e.target.value }))} fullWidth /></Grid>
          </Grid>
          <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden', height: 360 }}>
            <iframe title="Map picker" src={mapSrc} width="100%" height="100%" style={{ border: 'none' }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapPickerOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="md" fullWidth>
        <DialogTitle>View / Update Store Information</DialogTitle>
        <DialogContent>
          {editingStore ? (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}><TextField label="Store Name" value={editingStore.name} onChange={(e) => setEditingStore((prev) => ({ ...prev, name: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={6}><TextField label="Category" value={editingStore.category} onChange={(e) => setEditingStore((prev) => ({ ...prev, category: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12}><TextField label="Description" value={editingStore.description} onChange={(e) => setEditingStore((prev) => ({ ...prev, description: e.target.value }))} fullWidth multiline rows={2} /></Grid>
              <Grid item xs={12} md={6}><TextField label="Store Logo (base64/url)" value={editingStore.image} onChange={(e) => setEditingStore((prev) => ({ ...prev, image: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={6}><TextField label="Store Banner (base64/url)" value={editingStore.bannerImage} onChange={(e) => setEditingStore((prev) => ({ ...prev, bannerImage: e.target.value }))} fullWidth /></Grid>

              <Grid item xs={12} md={4}><TextField label="Country" value={editingStore.country} onChange={(e) => setEditingStore((prev) => ({ ...prev, country: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="City / Town" value={editingStore.city} onChange={(e) => setEditingStore((prev) => ({ ...prev, city: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Area / Neighborhood" value={editingStore.area} onChange={(e) => setEditingStore((prev) => ({ ...prev, area: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={6}><TextField label="Street Address" value={editingStore.streetAddress} onChange={(e) => setEditingStore((prev) => ({ ...prev, streetAddress: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField label="Building / Shop Number" value={editingStore.buildingNumber} onChange={(e) => setEditingStore((prev) => ({ ...prev, buildingNumber: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField label="Landmark" value={editingStore.landmark} onChange={(e) => setEditingStore((prev) => ({ ...prev, landmark: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Latitude" type="number" value={editingStore.latitude} onChange={(e) => setEditingStore((prev) => ({ ...prev, latitude: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Longitude" type="number" value={editingStore.longitude} onChange={(e) => setEditingStore((prev) => ({ ...prev, longitude: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Delivery Radius (KM)" type="number" value={editingStore.deliveryRadiusKm} onChange={(e) => setEditingStore((prev) => ({ ...prev, deliveryRadiusKm: e.target.value }))} fullWidth /></Grid>

              <Grid item xs={12} md={4}><TextField label="Prep Time (min)" type="number" value={editingStore.orderPreparationTimeMin} onChange={(e) => setEditingStore((prev) => ({ ...prev, orderPreparationTimeMin: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Minimum Order Amount" type="number" value={editingStore.minimumOrderAmount} onChange={(e) => setEditingStore((prev) => ({ ...prev, minimumOrderAmount: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Store Phone" value={editingStore.phone} onChange={(e) => setEditingStore((prev) => ({ ...prev, phone: e.target.value }))} fullWidth /></Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <Select value={editingStore.deliveryMethod} onChange={(e) => setEditingStore((prev) => ({ ...prev, deliveryMethod: e.target.value }))}>
                    {DELIVERY_METHODS.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <Select value={editingStore.deliveryFeeType} onChange={(e) => setEditingStore((prev) => ({ ...prev, deliveryFeeType: e.target.value }))}>
                    {DELIVERY_FEE_TYPES.map((feeType) => <MenuItem key={feeType} value={feeType}>{feeType}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}><TextField label="Delivery Fee Value" type="number" value={editingStore.deliveryFeeValue} onChange={(e) => setEditingStore((prev) => ({ ...prev, deliveryFeeValue: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Free Delivery Threshold" type="number" value={editingStore.freeDeliveryThreshold} onChange={(e) => setEditingStore((prev) => ({ ...prev, freeDeliveryThreshold: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={Boolean(editingStore.allowPickup)} onChange={(e) => setEditingStore((prev) => ({ ...prev, allowPickup: e.target.checked }))} />} label="Allow Pickup" /></Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <Select value={editingStore.payoutMethod} onChange={(e) => setEditingStore((prev) => ({ ...prev, payoutMethod: e.target.value }))}>
                    {PAYOUT_METHODS.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}><TextField label="Bank Name" value={editingStore.bankName} onChange={(e) => setEditingStore((prev) => ({ ...prev, bankName: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Account Name" value={editingStore.accountName} onChange={(e) => setEditingStore((prev) => ({ ...prev, accountName: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="Account Number" value={editingStore.accountNumber} onChange={(e) => setEditingStore((prev) => ({ ...prev, accountNumber: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="M-Pesa Number" value={editingStore.mpesaNumber} onChange={(e) => setEditingStore((prev) => ({ ...prev, mpesaNumber: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={4}><TextField label="M-Pesa Registered Name" value={editingStore.mpesaRegisteredName} onChange={(e) => setEditingStore((prev) => ({ ...prev, mpesaRegisteredName: e.target.value }))} fullWidth /></Grid>

              <Grid item xs={12} md={6}><TextField label="Tax/KRA PIN" value={editingStore.taxPin} onChange={(e) => setEditingStore((prev) => ({ ...prev, taxPin: e.target.value }))} fullWidth /></Grid>
              <Grid item xs={12} md={6}><TextField label="Review Notes" value={editingStore.reviewNotes} onChange={(e) => setEditingStore((prev) => ({ ...prev, reviewNotes: e.target.value }))} fullWidth multiline rows={2} /></Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>Close</Button>
          <Button variant="contained" onClick={handleSaveStoreInfo} disabled={isSavingEdit || !editingStore?.id}>
            {isSavingEdit ? 'Saving...' : 'Save Updates'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manageCredentialsOpen} onClose={handleCloseCredentialsEditor} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Merchant Credentials - {credentialsStoreName}</DialogTitle>
        <DialogContent>
          <TextField label="Merchant Name" value={credentialsName} onChange={(e) => setCredentialsName(e.target.value)} fullWidth margin="dense" />
          <TextField label="Merchant Username" value={credentialsUsername} onChange={(e) => setCredentialsUsername(e.target.value)} fullWidth margin="dense" />
          <TextField label="Merchant Email" type="email" value={credentialsEmail} onChange={(e) => setCredentialsEmail(e.target.value)} fullWidth margin="dense" />
          <TextField label="Merchant Phone" value={credentialsPhone} onChange={(e) => setCredentialsPhone(e.target.value)} fullWidth margin="dense" />
          <TextField
            label="New Password (optional)"
            type="password"
            value={credentialsPassword}
            onChange={(e) => setCredentialsPassword(e.target.value)}
            fullWidth
            margin="dense"
            helperText="Leave blank to keep existing password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCredentialsEditor}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateCredentials}>Save Credentials</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={credentialsDialogOpen} onClose={handleCloseCredentialsDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Merchant Credentials Created</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Store {createdCredentials.storeName} has been created with a dedicated merchant account.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save these credentials now. For security reasons, the password is shown only once.
          </Typography>

          <TextField label="Merchant Name" value={createdCredentials.ownerName} fullWidth margin="dense" InputProps={{ readOnly: true }} />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField label="Merchant Username" value={createdCredentials.username} fullWidth margin="dense" InputProps={{ readOnly: true }} />
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => handleCopyText('Username', createdCredentials.username)}
              sx={{ mt: 1 }}
            >
              Copy
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField label="Merchant Password" value={createdCredentials.password} type="text" fullWidth margin="dense" InputProps={{ readOnly: true }} />
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => handleCopyText('Password', createdCredentials.password)}
              sx={{ mt: 1 }}
            >
              Copy
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2 }}>
            Merchant login path: /merchant/login.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCloseCredentialsDialog}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Stores;
