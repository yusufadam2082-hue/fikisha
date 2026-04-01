import { useEffect, useMemo, useState } from 'react';
import { useStoreContext, type Store, type Product, type CreateStoreInput } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit2, ChevronLeft, Search, Trash2, ToggleLeft, ToggleRight, X, Save, BarChart3, Package, DollarSign, Star, Clock, MapPin, Filter, Navigation, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatKES } from '../../utils/currency';
import { compressImageToBase64 } from '../../utils/imageUpload';
import { LocationPickerMap } from '../../components/ui/LocationPickerMap';

const ONBOARDING_DRAFT_KEY = 'admin_store_onboarding_draft_v1';

const STORE_CATEGORIES = ['grocery', 'restaurant', 'pharmacy', 'electronics', 'fashion', 'beauty', 'hardware', 'other'];

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const createDefaultOpeningHours = () => DAY_KEYS.reduce((acc, day) => {
  acc[day] = { open: '08:00', close: '21:00', closed: false };
  return acc;
}, {} as Record<string, { open: string; close: string; closed?: boolean }>);

const createEmptyStoreDraft = (): CreateStoreInput => ({
  name: '',
  rating: 5,
  time: '20-30 min',
  deliveryFee: 2.99,
  category: '',
  image: '',
  bannerImage: '',
  description: '',
  address: '',
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  ownerName: '',
  ownerUsername: '',
  ownerPassword: '',
  ownerEmail: '',
  ownerPhone: '',
  country: '',
  city: '',
  area: '',
  streetAddress: '',
  buildingNumber: '',
  landmark: '',
  latitude: undefined,
  longitude: undefined,
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
  confirmedAuthorization: false,
  onboardingCompleted: false,
  onboardingDraft: ''
});

type AddressSearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export function StoreManager() {
  const { stores, addStore, updateStore, addProduct, updateProduct, deleteProduct, deleteStore, reviewStore } = useStoreContext();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [viewMode, setViewMode] = useState<'products' | 'analytics'>('products');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending' | 'docs_required' | 'approved' | 'rejected' | 'suspended'>('all');
  
  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [bulkMenu, setBulkMenu] = useState(false);

  // Add/Edit Store
  const [showAddStore, setShowAddStore] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<AddressSearchResult[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});

  // Add/Edit Product
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('9.99');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImage, setNewProductImage] = useState('');

  const [newStore, setNewStore] = useState<CreateStoreInput>(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) {
        return createEmptyStoreDraft();
      }
      return { ...createEmptyStoreDraft(), ...JSON.parse(raw) };
    } catch {
      return createEmptyStoreDraft();
    }
  });

  useEffect(() => {
    if (!showAddStore) {
      return;
    }
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(newStore));
  }, [newStore, showAddStore]);

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (!newStore.fullName || !newStore.email || !newStore.phone || !newStore.password || !newStore.confirmPassword) {
        return 'Fill all account fields before continuing.';
      }
      if (newStore.password !== newStore.confirmPassword) {
        return 'Passwords do not match.';
      }
      if (!/^\+[1-9]\d{7,14}$/.test(String(newStore.phone || '').replace(/[\s\-()]/g, ''))) {
        return 'Phone number must be in international format (for example +255700000000).';
      }
    }
    if (step === 2) {
      if (!newStore.name || !newStore.category || !newStore.description || !newStore.image) {
        return 'Store name, category, description, and logo are required.';
      }
    }
    if (step === 3) {
      if (!newStore.country || !newStore.city || !newStore.area || !newStore.streetAddress) {
        return 'Country, city/town, area, and street address are required.';
      }
      if (newStore.latitude === undefined || newStore.longitude === undefined) {
        return 'Pick a map location or detect current location to save latitude/longitude.';
      }
    }
    if (step === 4) {
      if (!newStore.orderPreparationTimeMin || newStore.orderPreparationTimeMin < 1) {
        return 'Order preparation time is required.';
      }
      if (!newStore.deliveryMethod || !newStore.deliveryFeeType) {
        return 'Delivery setup is incomplete.';
      }
    }
    if (step === 7) {
      if (!newStore.acceptedTerms || !newStore.acceptedPrivacy || !newStore.confirmedAccurate || !newStore.confirmedAuthorization) {
        return 'You must confirm all legal declarations before submission.';
      }
    }
    return null;
  };

  const handleStepNext = () => {
    const validationError = validateStep(onboardingStep);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError('');
    setOnboardingStep((prev) => Math.min(7, prev + 1));
  };

  const handleStepBack = () => {
    setCreateError('');
    setOnboardingStep((prev) => Math.max(1, prev - 1));
  };

  const handleUploadToBase64 = async (file: File | null, target: 'image' | 'bannerImage' | 'ownerIdDocument' | 'businessPermitDocument' | 'proofOfAddressDocument') => {
    if (!file) {
      return;
    }
    const encoded = await compressImageToBase64(file);
    setNewStore(prev => ({ ...prev, [target]: encoded }));
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
        headers: { 'User-Agent': 'FikishaAdminWeb/1.0' }
      });
      if (!response.ok) {
        throw new Error('Address lookup failed');
      }
      const data = await response.json() as AddressSearchResult[];
      setLocationResults(data || []);
    } catch {
      setLocationResults([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCreateError('Geolocation is not supported on this browser.');
      return;
    }

    setIsDetectingLocation(true);
    setCreateError('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setNewStore(prev => ({ ...prev, latitude: lat, longitude: lng }));

      try {
        const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
          headers: { 'User-Agent': 'FikishaAdminWeb/1.0' }
        });
        if (reverseRes.ok) {
          const reverseData = await reverseRes.json() as { display_name?: string; address?: Record<string, string> };
          setNewStore(prev => ({
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
        // keep coordinates when reverse lookup fails
      } finally {
        setIsDetectingLocation(false);
      }
    }, () => {
      setIsDetectingLocation(false);
      setCreateError('Unable to detect location. Check browser permissions and try again.');
    }, {
      enableHighAccuracy: true,
      timeout: 15000
    });
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(stores.map(s => s.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [stores]);

  // Filter stores
  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || store.category === categoryFilter;
      const normalizedStatus = String(store.status || '').toUpperCase();
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && store.isActive !== false) ||
        (statusFilter === 'inactive' && store.isActive === false) ||
        (statusFilter === 'pending' && normalizedStatus === 'PENDING_REVIEW') ||
        (statusFilter === 'docs_required' && normalizedStatus === 'DOCUMENTS_REQUIRED') ||
        (statusFilter === 'approved' && normalizedStatus === 'APPROVED') ||
        (statusFilter === 'rejected' && normalizedStatus === 'REJECTED') ||
        (statusFilter === 'suspended' && normalizedStatus === 'SUSPENDED');
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [stores, searchQuery, categoryFilter, statusFilter]);

  const activeStore = selectedStore ? stores.find(s => s.id === selectedStore.id) : null;

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateStep(1) || validateStep(2) || validateStep(3) || validateStep(4) || validateStep(7);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError('');
    setIsCreatingStore(true);
    try {
      await addStore({
        ...newStore,
        ownerName: newStore.fullName,
        ownerEmail: newStore.email,
        ownerPhone: newStore.phone,
        ownerPassword: newStore.password,
        onboardingCompleted: true,
        onboardingDraft: ''
      } as CreateStoreInput);
      setShowAddStore(false);
      setNewStore(createEmptyStoreDraft());
      setOnboardingStep(1);
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create store');
    } finally {
      setIsCreatingStore(false);
    }
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    try {
      await updateStore(editingStore.id, {
        name: editingStore.name,
        category: editingStore.category,
        image: editingStore.image,
        description: editingStore.description,
        address: editingStore.address,
        phone: editingStore.phone,
        time: editingStore.time,
        deliveryFee: editingStore.deliveryFee,
        isActive: editingStore.isActive,
        isOpen: editingStore.isOpen,
        openingHours: editingStore.openingHours
      });
      setEditingStore(null);
      setSelectedStore(stores.find(s => s.id === selectedStore?.id) || null);
    } catch (error) {
      console.error('Failed to update store', error);
    }
  };

  const handleToggleStoreStatus = async (storeId: string, field: 'isActive' | 'isOpen') => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      await updateStore(storeId, { [field]: !(store as any)[field] });
    }
  };

  const handleStoreReviewAction = async (storeId: string, action: 'approve' | 'reject' | 'request_documents' | 'suspend' | 'activate') => {
    setActionError('');
    try {
      await reviewStore(storeId, {
        action,
        reason: reviewReason[storeId] || undefined,
        requestedDocs: action === 'request_documents' ? ['owner_id_document', 'business_permit', 'tax_pin'] : undefined
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to process store action');
    }
  };

  const getStatusBadge = (store: Store) => {
    const status = (store.status || '').toUpperCase();
    if (status === 'PENDING_REVIEW') return { label: 'Pending Review', bg: '#f59e0b' };
    if (status === 'DOCUMENTS_REQUIRED') return { label: 'Docs Required', bg: '#f97316' };
    if (status === 'APPROVED') return { label: 'Approved', bg: '#0ea5e9' };
    if (status === 'ACTIVE') return { label: 'Active', bg: '#16a34a' };
    if (status === 'SUSPENDED') return { label: 'Suspended', bg: '#dc2626' };
    if (status === 'REJECTED') return { label: 'Rejected', bg: '#7f1d1d' };
    return { label: store.isActive === false ? 'Inactive' : 'Draft', bg: '#6b7280' };
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !newProductName) return;
    addProduct(selectedStore.id, {
      name: newProductName,
      description: newProductDesc || 'A delicious product.',
      price: parseFloat(newProductPrice) || 0,
      image: newProductImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'
    });
    setShowAddProduct(false);
    setNewProductName('');
    setNewProductPrice('9.99');
    setNewProductDesc('');
    setNewProductImage('');
    setSelectedStore(stores.find(s => s.id === selectedStore.id) || null);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !editingProduct) return;
    updateProduct(selectedStore.id, editingProduct.id, {
      name: editingProduct.name,
      description: editingProduct.description,
      price: editingProduct.price,
      image: editingProduct.image
    });
    setEditingProduct(null);
    setSelectedStore(stores.find(s => s.id === selectedStore.id) || null);
  };

  const handleToggleProductAvailability = async (productId: string) => {
    if (!selectedStore) return;
    const product = selectedStore.products.find(p => p.id === productId);
    if (product) {
      await updateProduct(selectedStore.id, productId, { 
        available: !(product as any).available 
      });
      setSelectedStore(stores.find(s => s.id === selectedStore.id) || null);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!selectedStore) return;
    await deleteProduct(selectedStore.id, productId);
    setSelectedStore(stores.find(s => s.id === selectedStore.id) || null);
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this store?')) return;

    setActionError('');
    try {
      await deleteStore(storeId);
      setSelectedStores(prev => {
        const next = new Set(prev);
        next.delete(storeId);
        return next;
      });
      if (selectedStore?.id === storeId) {
        setSelectedStore(null);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete store');
    }
  };

  const handleBulkDeleteStores = async () => {
    if (selectedStores.size === 0) return;
    if (!confirm(`Delete ${selectedStores.size} selected store(s)? This cannot be undone.`)) return;

    setActionError('');
    const storeIds = Array.from(selectedStores);
    const failures: string[] = [];

    for (const storeId of storeIds) {
      try {
        await deleteStore(storeId);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `Failed to delete store ${storeId}`);
      }
    }

    if (failures.length > 0) {
      setActionError(failures[0]);
    }

    setSelectedStores(new Set());
    if (selectedStore && storeIds.includes(selectedStore.id)) {
      setSelectedStore(null);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStores(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const selectAllProducts = () => {
    if (!selectedStore) return;
    if (selectedProducts.size === selectedStore.products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(selectedStore.products.map(p => p.id)));
    }
  };

  const bulkDeleteProducts = async () => {
    if (!selectedStore || selectedProducts.size === 0) return;
    for (const productId of selectedProducts) {
      await deleteProduct(selectedStore.id, productId);
    }
    setSelectedProducts(new Set());
    setBulkMenu(false);
    setSelectedStore(stores.find(s => s.id === selectedStore.id) || null);
  };

  // Store Detail View
  if (activeStore) {
    return (
      <div className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button className="btn-icon" onClick={() => { setSelectedStore(null); setEditingStore(null); }}>
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-h1">Managing: {activeStore.name}</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button 
              className="btn-icon" 
              onClick={() => handleToggleStoreStatus(activeStore.id, 'isOpen')}
              title={activeStore.isOpen ? 'Close Store' : 'Open Store'}
              style={{ color: activeStore.isOpen !== false ? '#22c55e' : '#ef4444' }}
            >
              {activeStore.isOpen !== false ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
            <button 
              className="btn-icon" 
              onClick={() => handleToggleStoreStatus(activeStore.id, 'isActive')}
              title={activeStore.isActive === false ? 'Activate Store' : 'Deactivate Store'}
              style={{ color: activeStore.isActive === false ? '#ef4444' : '#22c55e' }}
            >
              {activeStore.isActive === false ? <ToggleLeft size={24} /> : <ToggleRight size={24} />}
            </button>
            <Button variant="outline" size="sm" onClick={() => setEditingStore(activeStore)}>
              <Edit2 size={16} /> Edit Store
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <button
            onClick={() => setViewMode('products')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: viewMode === 'products' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'products' ? 'white' : 'var(--text-main)',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Package size={18} /> Products ({activeStore.products.length})
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: viewMode === 'analytics' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'analytics' ? 'white' : 'var(--text-main)',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <BarChart3 size={18} /> Analytics
          </button>
        </div>

        {viewMode === 'products' && (
          <>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button onClick={() => setShowAddProduct(!showAddProduct)}>
                  <Plus size={18} /> Add Product
                </Button>
                {activeStore && activeStore.products.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setBulkMenu(!bulkMenu)}>
                      {selectedProducts.size > 0 ? `${selectedProducts.size} Selected` : 'Bulk Actions'}
                    </Button>
                    {selectedProducts.size > 0 && (
                      <Button variant="outline" size="sm" onClick={bulkDeleteProducts} style={{ color: 'var(--error)' }}>
                        <Trash2 size={16} /> Delete Selected
                      </Button>
                    )}
                  </>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={activeStore ? selectedProducts.size === activeStore.products.length && activeStore.products.length > 0 : false}
                  onChange={() => selectAllProducts()}
                />
                Select All
              </label>
            </div>

            {showAddProduct && (
              <Card style={{ padding: '24px', marginBottom: '32px', border: '2px dashed var(--primary)' }} hoverable={false}>
                <h3 className="text-h3" style={{ marginBottom: '16px' }}>Add New Product</h3>
                <form onSubmit={handleCreateProduct} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Product Name</label>
                    <input type="text" className="input-field" value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="e.g. Cheese Pizza" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Price</label>
                    <input type="number" step="0.01" className="input-field" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} placeholder="9.99" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Image URL</label>
                    <input type="text" className="input-field" value={newProductImage} onChange={e => setNewProductImage(e.target.value)} placeholder="https://..." />
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Description</label>
                    <textarea className="input-field" rows={2} value={newProductDesc} onChange={e => setNewProductDesc(e.target.value)} placeholder="Product description" />
                  </div>
                  <div style={{ gridColumn: 'span 3', display: 'flex', gap: '8px' }}>
                    <Button type="button" variant="outline" onClick={() => setShowAddProduct(false)}>Cancel</Button>
                    <Button type="submit">Save Product</Button>
                  </div>
                </form>
              </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
              {activeStore.products.map((product: Product) => (
                <Card key={product.id} style={{ display: 'flex', gap: '16px', padding: '16px', opacity: (product as any).available === false ? 0.6 : 1 }}>
                  <div style={{ width: selectedProducts.size > 0 ? '32px' : '80px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: '8px' }}>
                    {selectedProducts.size > 0 ? (
                      <input 
                        type="checkbox" 
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    ) : (
                      <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                  {selectedProducts.size === 0 && (
                    <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 className="text-h3" style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{product.name}</h4>
                        <p className="text-sm text-muted" style={{ marginBottom: '8px' }}>{product.description}</p>
                        <p className="text-body font-bold text-muted">{formatKES(product.price)}</p>
                      </div>
                      {(product as any).available === false && (
                        <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.7rem', fontWeight: 600 }}>Unavailable</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleToggleProductAvailability(product.id)}
                        title={(product as any).available === false ? 'Mark Available' : 'Mark Unavailable'}
                        style={{ color: (product as any).available === false ? '#22c55e' : '#f59e0b' }}
                      >
                        {(product as any).available === false ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button className="btn-icon" onClick={() => setEditingProduct(product)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => handleDeleteProduct(product.id)} style={{ color: 'var(--error)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {viewMode === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={24} color="white" />
                </div>
                <div>
                  <p className="text-sm text-muted">Total Products</p>
                  <h2 className="text-h2">{activeStore.products.length}</h2>
                </div>
              </div>
            </Card>
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={24} color="white" />
                </div>
                <div>
                  <p className="text-sm text-muted">Total Revenue</p>
                  <h2 className="text-h2">{formatKES(Number(activeStore.totalRevenue || Math.floor(Math.random() * 5000) + 1000))}</h2>
                </div>
              </div>
            </Card>
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={24} color="white" />
                </div>
                <div>
                  <p className="text-sm text-muted">Total Orders</p>
                  <h2 className="text-h2">{activeStore.totalOrders || Math.floor(Math.random() * 200) + 50}</h2>
                </div>
              </div>
            </Card>
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star size={24} color="white" />
                </div>
                <div>
                  <p className="text-sm text-muted">Average Rating</p>
                  <h2 className="text-h2">{activeStore.rating.toFixed(1)}</h2>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Edit Store Modal */}
        {editingStore && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }} onClick={() => setEditingStore(null)}>
            <div style={{ padding: '32px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-lg)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="text-h2">Edit Store</h2>
                <button className="btn-icon" onClick={() => setEditingStore(null)}><X size={24} /></button>
              </div>
              <form onSubmit={handleUpdateStore} style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <input type="text" className="input-field" placeholder="Store Name" value={editingStore.name} onChange={e => setEditingStore({ ...editingStore, name: e.target.value })} />
                  <input type="text" className="input-field" placeholder="Category" value={editingStore.category || ''} onChange={e => setEditingStore({ ...editingStore, category: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <input type="text" className="input-field" placeholder="Delivery Time" value={editingStore.time} onChange={e => setEditingStore({ ...editingStore, time: e.target.value })} />
                  <input type="number" step="0.01" className="input-field" placeholder="Delivery Fee" value={editingStore.deliveryFee} onChange={e => setEditingStore({ ...editingStore, deliveryFee: parseFloat(e.target.value) || 0 })} />
                </div>
                <input type="text" className="input-field" placeholder="Store Image URL" value={editingStore.image} onChange={e => setEditingStore({ ...editingStore, image: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <input type="text" className="input-field" placeholder="Phone" value={editingStore.phone || ''} onChange={e => setEditingStore({ ...editingStore, phone: e.target.value })} />
                  <input type="text" className="input-field" placeholder="Address" value={editingStore.address || ''} onChange={e => setEditingStore({ ...editingStore, address: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Opening Time</label>
                    <input type="time" className="input-field" value={editingStore.openingHours?.open || '09:00'} onChange={e => setEditingStore({ ...editingStore, openingHours: { ...editingStore.openingHours!, open: e.target.value } })} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Closing Time</label>
                    <input type="time" className="input-field" value={editingStore.openingHours?.close || '22:00'} onChange={e => setEditingStore({ ...editingStore, openingHours: { ...editingStore.openingHours!, close: e.target.value } })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingStore.isOpen !== false} onChange={() => setEditingStore({ ...editingStore, isOpen: !editingStore.isOpen })} />
                    Store is Open
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingStore.isActive !== false} onChange={() => setEditingStore({ ...editingStore, isActive: !editingStore.isActive })} />
                    Store is Active
                  </label>
                </div>
                <textarea className="input-field" rows={3} placeholder="Description" value={editingStore.description} onChange={e => setEditingStore({ ...editingStore, description: e.target.value })} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button type="button" variant="outline" onClick={() => setEditingStore(null)}>Cancel</Button>
                  <Button type="submit"><Save size={16} /> Save Changes</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit Product Modal
  if (editingProduct) {
    return (
      <div className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button className="btn-icon" onClick={() => setEditingProduct(null)}>
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-h1">Edit Product</h1>
        </div>
        <Card style={{ padding: '32px', maxWidth: '600px' }}>
          <form onSubmit={handleUpdateProduct} style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Product Name</label>
              <input type="text" className="input-field" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} style={{ width: '100%' }} />
            </div>
            <div>
              <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Description</label>
              <textarea className="input-field" rows={3} value={editingProduct.description} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Price</label>
                <input type="number" step="0.01" className="input-field" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} style={{ width: '100%' }} />
              </div>
              <div>
                <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>Image URL</label>
                <input type="text" className="input-field" value={editingProduct.image} onChange={e => setEditingProduct({ ...editingProduct, image: e.target.value })} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
              <Button type="submit"><Save size={16} /> Save Changes</Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // Main Store List View
  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <h1 className="text-h1">Store Management</h1>
        <Button onClick={() => setShowAddStore(!showAddStore)}>
          <Plus size={20} /> Add New Store
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <Card style={{ padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="input-wrapper" style={{ flex: '1', minWidth: '200px' }}>
            <Search className="input-icon" size={18} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search stores..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} color="var(--text-muted)" />
            <select 
              className="input-field" 
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
              ))}
            </select>
          </div>
          <select 
            className="input-field" 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ minWidth: '130px' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending Review</option>
            <option value="docs_required">Docs Required</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          {selectedStores.size > 0 && (
            <Button variant="outline" size="sm" style={{ color: 'var(--error)' }} onClick={handleBulkDeleteStores}>
              <Trash2 size={16} /> Delete ({selectedStores.size})
            </Button>
          )}
        </div>
      </Card>

      {actionError ? (
        <p className="text-sm" style={{ color: 'var(--error)', marginBottom: '16px' }}>
          {actionError}
        </p>
      ) : null}

      {showAddStore && (
        <Card style={{ padding: '32px', marginBottom: '32px', border: '2px dashed var(--primary)' }} hoverable={false}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 className="text-h3" style={{ marginBottom: '8px' }}>Store Onboarding Wizard</h3>
              <p className="text-sm text-muted">Step {onboardingStep} of 7. Draft auto-saves locally while you work.</p>
            </div>
            <div style={{ minWidth: '220px' }}>
              <div style={{ height: '8px', borderRadius: '999px', background: 'var(--surface-hover)', overflow: 'hidden' }}>
                <div style={{ width: `${(onboardingStep / 7) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #0ea5e9, #16a34a)' }} />
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateStore} style={{ display: 'grid', gap: '16px' }}>
            {onboardingStep === 1 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 1: Account Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input className="input-field" placeholder="Full Name" value={newStore.fullName || ''} onChange={e => setNewStore({ ...newStore, fullName: e.target.value })} />
                  <input className="input-field" type="email" placeholder="Email Address" value={newStore.email || ''} onChange={e => setNewStore({ ...newStore, email: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <input className="input-field" placeholder="Phone Number (+255...)" value={newStore.phone || ''} onChange={e => setNewStore({ ...newStore, phone: e.target.value })} />
                  <input className="input-field" type="password" placeholder="Password" value={newStore.password || ''} onChange={e => setNewStore({ ...newStore, password: e.target.value })} />
                  <input className="input-field" type="password" placeholder="Confirm Password" value={newStore.confirmPassword || ''} onChange={e => setNewStore({ ...newStore, confirmPassword: e.target.value })} />
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 2: Store Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input className="input-field" placeholder="Store Name" value={newStore.name} onChange={e => setNewStore({ ...newStore, name: e.target.value })} />
                  <select className="input-field" value={newStore.category} onChange={e => setNewStore({ ...newStore, category: e.target.value })}>
                    <option value="">Select Category</option>
                    {STORE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
                <textarea className="input-field" rows={3} placeholder="Store Description" value={newStore.description} onChange={e => setNewStore({ ...newStore, description: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="text-sm" style={{ display: 'grid', gap: '8px' }}>
                    Store Logo (required)
                    <input type="file" accept="image/*" onChange={e => handleUploadToBase64(e.target.files?.[0] || null, 'image')} />
                    {newStore.image ? <span style={{ color: '#16a34a' }}>Uploaded</span> : null}
                  </label>
                  <label className="text-sm" style={{ display: 'grid', gap: '8px' }}>
                    Store Banner (optional)
                    <input type="file" accept="image/*" onChange={e => handleUploadToBase64(e.target.files?.[0] || null, 'bannerImage')} />
                    {newStore.bannerImage ? <span style={{ color: '#16a34a' }}>Uploaded</span> : null}
                  </label>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 3: Store Location</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <input className="input-field" placeholder="Country" value={newStore.country || ''} onChange={e => setNewStore({ ...newStore, country: e.target.value })} />
                  <input className="input-field" placeholder="City / Town" value={newStore.city || ''} onChange={e => setNewStore({ ...newStore, city: e.target.value })} />
                  <input className="input-field" placeholder="Area / Neighborhood" value={newStore.area || ''} onChange={e => setNewStore({ ...newStore, area: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <input className="input-field" placeholder="Street Address" value={newStore.streetAddress || ''} onChange={e => setNewStore({ ...newStore, streetAddress: e.target.value })} />
                  <input className="input-field" placeholder="Building / Shop Number" value={newStore.buildingNumber || ''} onChange={e => setNewStore({ ...newStore, buildingNumber: e.target.value })} />
                  <input className="input-field" placeholder="Landmark" value={newStore.landmark || ''} onChange={e => setNewStore({ ...newStore, landmark: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr auto auto', gap: '10px', alignItems: 'center' }}>
                  <input className="input-field" placeholder="Search address manually" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} />
                  <Button type="button" variant="outline" onClick={handleSearchAddress}><Search size={16} /> {isSearchingLocation ? 'Searching...' : 'Search'}</Button>
                  <Button type="button" variant="outline" onClick={handleUseCurrentLocation}><Navigation size={16} /> {isDetectingLocation ? 'Locating...' : 'Auto-detect'}</Button>
                </div>
                {locationResults.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', maxHeight: '170px', overflowY: 'auto' }}>
                    {locationResults.map((result, index) => (
                      <button
                        key={`${result.lat}-${result.lon}-${index}`}
                        type="button"
                        onClick={() => setNewStore({ ...newStore, latitude: Number(result.lat), longitude: Number(result.lon), address: result.display_name })}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      >
                        {result.display_name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Button type="button" variant="outline" onClick={() => setShowMapPicker(true)}><MapPin size={16} /> Open Map Picker</Button>
                  <input className="input-field" style={{ maxWidth: '160px' }} type="number" step="0.1" placeholder="Delivery Radius (KM)" value={newStore.deliveryRadiusKm || ''} onChange={e => setNewStore({ ...newStore, deliveryRadiusKm: parseFloat(e.target.value) || 0 })} />
                </div>
                <p className="text-sm text-muted">Latitude: {newStore.latitude ?? '--'} | Longitude: {newStore.longitude ?? '--'}</p>
              </div>
            )}

            {onboardingStep === 4 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 4: Operating & Delivery Setup</h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'grid', gap: '8px' }}>
                  <p className="text-sm text-muted" style={{ margin: 0 }}>Opening hours (daily schedule)</p>
                  {DAY_KEYS.map((day) => (
                    <div key={day} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <span style={{ textTransform: 'capitalize' }}>{day}</span>
                      <input
                        className="input-field"
                        type="time"
                        value={newStore.openingHours?.[day]?.open || '08:00'}
                        disabled={Boolean(newStore.openingHours?.[day]?.closed)}
                        onChange={e => setNewStore(prev => ({
                          ...prev,
                          openingHours: {
                            ...(prev.openingHours || {}),
                            [day]: {
                              ...(prev.openingHours?.[day] || { open: '08:00', close: '21:00', closed: false }),
                              open: e.target.value
                            }
                          }
                        }))}
                      />
                      <input
                        className="input-field"
                        type="time"
                        value={newStore.openingHours?.[day]?.close || '21:00'}
                        disabled={Boolean(newStore.openingHours?.[day]?.closed)}
                        onChange={e => setNewStore(prev => ({
                          ...prev,
                          openingHours: {
                            ...(prev.openingHours || {}),
                            [day]: {
                              ...(prev.openingHours?.[day] || { open: '08:00', close: '21:00', closed: false }),
                              close: e.target.value
                            }
                          }
                        }))}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(newStore.openingHours?.[day]?.closed)}
                          onChange={e => setNewStore(prev => ({
                            ...prev,
                            openingHours: {
                              ...(prev.openingHours || {}),
                              [day]: {
                                ...(prev.openingHours?.[day] || { open: '08:00', close: '21:00', closed: false }),
                                closed: e.target.checked
                              }
                            }
                          }))}
                        />
                        Closed
                      </label>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <input className="input-field" type="number" min={1} placeholder="Prep time (minutes)" value={newStore.orderPreparationTimeMin || ''} onChange={e => setNewStore({ ...newStore, orderPreparationTimeMin: parseInt(e.target.value, 10) || 0 })} />
                  <input className="input-field" type="number" min={0} step="0.01" placeholder="Minimum order" value={newStore.minimumOrderAmount || ''} onChange={e => setNewStore({ ...newStore, minimumOrderAmount: parseFloat(e.target.value) || 0 })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={Boolean(newStore.allowPickup)} onChange={e => setNewStore({ ...newStore, allowPickup: e.target.checked })} />
                    Allow pickup
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <select className="input-field" value={newStore.deliveryMethod || 'PLATFORM_DRIVERS'} onChange={e => setNewStore({ ...newStore, deliveryMethod: e.target.value as CreateStoreInput['deliveryMethod'] })}>
                    <option value="PLATFORM_DRIVERS">Platform drivers</option>
                    <option value="OWN_RIDERS">Own riders</option>
                    <option value="BOTH">Both</option>
                  </select>
                  <select className="input-field" value={newStore.deliveryFeeType || 'FIXED'} onChange={e => setNewStore({ ...newStore, deliveryFeeType: e.target.value as CreateStoreInput['deliveryFeeType'] })}>
                    <option value="FIXED">Fixed fee</option>
                    <option value="DISTANCE_BASED">Distance-based</option>
                    <option value="FREE_OVER_THRESHOLD">Free over threshold</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input className="input-field" type="number" min={0} step="0.01" placeholder="Delivery fee value" value={newStore.deliveryFeeValue || ''} onChange={e => setNewStore({ ...newStore, deliveryFeeValue: parseFloat(e.target.value) || 0 })} />
                  <input className="input-field" type="number" min={0} step="0.01" placeholder="Free delivery threshold" value={newStore.freeDeliveryThreshold || ''} onChange={e => setNewStore({ ...newStore, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            )}

            {onboardingStep === 5 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 5: Verification & Compliance</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="text-sm" style={{ display: 'grid', gap: '8px' }}>
                    Owner National ID / Passport
                    <input type="file" accept="image/*,.pdf" onChange={e => handleUploadToBase64(e.target.files?.[0] || null, 'ownerIdDocument')} />
                  </label>
                  <label className="text-sm" style={{ display: 'grid', gap: '8px' }}>
                    Business Permit / License
                    <input type="file" accept="image/*,.pdf" onChange={e => handleUploadToBase64(e.target.files?.[0] || null, 'businessPermitDocument')} />
                  </label>
                </div>
                <input className="input-field" placeholder="Tax/KRA PIN" value={newStore.taxPin || ''} onChange={e => setNewStore({ ...newStore, taxPin: e.target.value })} />
                <label className="text-sm" style={{ display: 'grid', gap: '8px' }}>
                  Proof of Address (optional)
                  <input type="file" accept="image/*,.pdf" onChange={e => handleUploadToBase64(e.target.files?.[0] || null, 'proofOfAddressDocument')} />
                </label>
              </div>
            )}

            {onboardingStep === 6 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 6: Payout Setup</h4>
                <select className="input-field" value={newStore.payoutMethod || 'MPESA'} onChange={e => setNewStore({ ...newStore, payoutMethod: e.target.value as CreateStoreInput['payoutMethod'] })}>
                  <option value="BANK">Bank</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="WALLET">Wallet</option>
                </select>
                {(newStore.payoutMethod || 'MPESA') === 'BANK' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <input className="input-field" placeholder="Bank Name" value={newStore.bankName || ''} onChange={e => setNewStore({ ...newStore, bankName: e.target.value })} />
                    <input className="input-field" placeholder="Account Name" value={newStore.accountName || ''} onChange={e => setNewStore({ ...newStore, accountName: e.target.value })} />
                    <input className="input-field" placeholder="Account Number" value={newStore.accountNumber || ''} onChange={e => setNewStore({ ...newStore, accountNumber: e.target.value })} />
                  </div>
                )}
                {(newStore.payoutMethod || 'MPESA') === 'MPESA' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input className="input-field" placeholder="M-Pesa Number" value={newStore.mpesaNumber || ''} onChange={e => setNewStore({ ...newStore, mpesaNumber: e.target.value })} />
                    <input className="input-field" placeholder="M-Pesa Registered Name" value={newStore.mpesaRegisteredName || ''} onChange={e => setNewStore({ ...newStore, mpesaRegisteredName: e.target.value })} />
                  </div>
                )}
              </div>
            )}

            {onboardingStep === 7 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <h4 className="text-h3" style={{ fontSize: '1.05rem' }}>Step 7: Legal & Submission</h4>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={Boolean(newStore.acceptedTerms)} onChange={e => setNewStore({ ...newStore, acceptedTerms: e.target.checked })} /> Accept Terms & Conditions</label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={Boolean(newStore.acceptedPrivacy)} onChange={e => setNewStore({ ...newStore, acceptedPrivacy: e.target.checked })} /> Accept Privacy Policy</label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={Boolean(newStore.confirmedAccurate)} onChange={e => setNewStore({ ...newStore, confirmedAccurate: e.target.checked })} /> Confirm information is accurate</label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={Boolean(newStore.confirmedAuthorization)} onChange={e => setNewStore({ ...newStore, confirmedAuthorization: e.target.checked })} /> Confirm authorization to register business</label>
                <div style={{ marginTop: '8px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(14,165,233,0.08)' }}>
                  <p className="text-sm" style={{ margin: 0 }}>After submission the store is created as <strong>Pending Review</strong>. Verification and payout can be completed later before go-live.</p>
                </div>
              </div>
            )}

            {createError ? <p className="text-sm" style={{ color: 'var(--error)' }}>{createError}</p> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <Button type="button" variant="outline" onClick={() => {
                  setShowAddStore(false);
                  localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(newStore));
                }}>Save Draft & Close</Button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="button" variant="outline" onClick={handleStepBack} disabled={onboardingStep === 1}>Back</Button>
                {onboardingStep < 7 ? (
                  <Button type="button" onClick={handleStepNext}>Next</Button>
                ) : (
                  <Button type="submit" size="lg" disabled={isCreatingStore}>{isCreatingStore ? 'Submitting...' : 'Submit For Review'}</Button>
                )}
              </div>
            </div>
          </form>

          {showMapPicker && (
            <LocationPickerMap
              onCancel={() => setShowMapPicker(false)}
              initialCenter={newStore.latitude !== undefined && newStore.longitude !== undefined
                ? { lat: newStore.latitude, lng: newStore.longitude }
                : undefined}
              onConfirm={(coords) => {
                setNewStore(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
                setShowMapPicker(false);
              }}
            />
          )}
        </Card>
      )}

      {/* Results count */}
      <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>
        Showing {filteredStores.length} of {stores.length} stores
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {filteredStores.map(store => (
          <Card key={store.id} style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', gap: '16px' }} hoverable={false}>
            <input 
              type="checkbox" 
              checked={selectedStores.has(store.id)}
              onChange={() => toggleStoreSelection(store.id)}
              style={{ width: '20px', height: '20px', marginTop: '8px', cursor: 'pointer' }}
            />
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <img src={store.image} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 className="text-h3">{store.name}</h3>
                <span style={{ background: getStatusBadge(store).bg, color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.65rem', fontWeight: 600 }}>
                  {getStatusBadge(store).label}
                </span>
                {store.isActive === false && (
                  <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.65rem', fontWeight: 600 }}>Inactive</span>
                )}
                {store.isOpen === false && (
                  <span style={{ background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: '0.65rem', fontWeight: 600 }}>Closed</span>
                )}
              </div>
              <p className="text-sm text-muted">{store.products.length} Products • {store.category}</p>
              {store.owner ? (
                <p className="text-sm text-muted">Merchant: {store.owner.name}</p>
              ) : null}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                <span className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={14} color="#f59e0b" /> {store.rating}
                </span>
                <span className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> {store.time}
                </span>
                <span className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} /> {store.address || 'No address'}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                <input
                  className="input-field"
                  placeholder="Review note (optional)"
                  value={reviewReason[store.id] || ''}
                  onChange={e => setReviewReason(prev => ({ ...prev, [store.id]: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <Button size="sm" variant="outline" onClick={() => handleStoreReviewAction(store.id, 'approve')}><CheckCircle2 size={14} /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStoreReviewAction(store.id, 'request_documents')}><AlertTriangle size={14} /> Request Docs</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStoreReviewAction(store.id, 'reject')}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStoreReviewAction(store.id, 'suspend')}>Suspend</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStoreReviewAction(store.id, 'activate')}><ShieldCheck size={14} /> Activate</Button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedStore(store)}>
                Manage
              </Button>
              <button 
                className="btn-icon" 
                onClick={() => handleDeleteStore(store.id)}
                style={{ color: 'var(--error)', alignSelf: 'flex-end' }}
                title="Delete Store"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {filteredStores.length === 0 && (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <p className="text-muted">No stores match your search criteria.</p>
        </Card>
      )}
    </div>
  );
}