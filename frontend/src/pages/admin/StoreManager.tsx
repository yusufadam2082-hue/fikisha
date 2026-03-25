import { useState, useMemo } from 'react';
import { useStoreContext, type Store, type Product, type CreateStoreInput } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit2, ChevronLeft, Search, Trash2, ToggleLeft, ToggleRight, X, Save, BarChart3, Package, DollarSign, Star, Clock, MapPin, Filter } from 'lucide-react';
import { formatKES } from '../../utils/currency';

export function StoreManager() {
  const { stores, addStore, updateStore, addProduct, updateProduct, deleteProduct, deleteStore } = useStoreContext();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [viewMode, setViewMode] = useState<'products' | 'analytics'>('products');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
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

  // Add/Edit Product
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('9.99');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImage, setNewProductImage] = useState('');

  const [newStore, setNewStore] = useState<CreateStoreInput>({
    name: '',
    rating: 5,
    time: '20-30 min',
    deliveryFee: 2.99,
    category: '',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    description: '',
    address: '',
    phone: '',
    ownerName: '',
    ownerUsername: '',
    ownerPassword: '',
    ownerEmail: '',
    ownerPhone: ''
  });

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
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && store.isActive !== false) ||
        (statusFilter === 'inactive' && store.isActive === false);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [stores, searchQuery, categoryFilter, statusFilter]);

  const activeStore = selectedStore ? stores.find(s => s.id === selectedStore.id) : null;

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name || !newStore.category || !newStore.description || !newStore.ownerName || !newStore.ownerUsername || !newStore.ownerPassword) {
      setCreateError('Complete the store and merchant credential fields.');
      return;
    }
    setCreateError('');
    setIsCreatingStore(true);
    try {
      await addStore(newStore as CreateStoreInput);
      setShowAddStore(false);
      setNewStore({
        name: '', rating: 5, time: '20-30 min', deliveryFee: 2.99, category: '',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
        description: '', address: '', phone: '', ownerName: '', ownerUsername: '',
        ownerPassword: '', ownerEmail: '', ownerPhone: ''
      });
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
          <h3 className="text-h3" style={{ marginBottom: '16px' }}>Create New Store And Merchant Login</h3>
          <form onSubmit={handleCreateStore} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input type="text" className="input-field" placeholder="Store Name" value={newStore.name} onChange={e => setNewStore({ ...newStore, name: e.target.value })} />
              <input type="text" className="input-field" placeholder="Category" value={newStore.category} onChange={e => setNewStore({ ...newStore, category: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input type="text" className="input-field" placeholder="Delivery Time" value={newStore.time} onChange={e => setNewStore({ ...newStore, time: e.target.value })} />
              <input type="number" step="0.01" className="input-field" placeholder="Delivery Fee" value={newStore.deliveryFee} onChange={e => setNewStore({ ...newStore, deliveryFee: parseFloat(e.target.value) || 0 })} />
            </div>
            <input type="text" className="input-field" placeholder="Store image URL" value={newStore.image} onChange={e => setNewStore({ ...newStore, image: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input type="text" className="input-field" placeholder="Store phone" value={newStore.phone} onChange={e => setNewStore({ ...newStore, phone: e.target.value })} />
              <input type="text" className="input-field" placeholder="Store address" value={newStore.address} onChange={e => setNewStore({ ...newStore, address: e.target.value })} />
            </div>
            <textarea className="input-field" rows={3} placeholder="Store description" value={newStore.description} onChange={e => setNewStore({ ...newStore, description: e.target.value })} />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h4 className="text-h3" style={{ marginBottom: '12px', fontSize: '1.1rem' }}>Merchant Account</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <input type="text" className="input-field" placeholder="Owner name" value={newStore.ownerName} onChange={e => setNewStore({ ...newStore, ownerName: e.target.value })} />
                <input type="text" className="input-field" placeholder="Username" value={newStore.ownerUsername} onChange={e => setNewStore({ ...newStore, ownerUsername: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <input type="password" className="input-field" placeholder="Temporary password" value={newStore.ownerPassword} onChange={e => setNewStore({ ...newStore, ownerPassword: e.target.value })} />
                <input type="email" className="input-field" placeholder="Owner email" value={newStore.ownerEmail} onChange={e => setNewStore({ ...newStore, ownerEmail: e.target.value })} />
                <input type="text" className="input-field" placeholder="Owner phone" value={newStore.ownerPhone} onChange={e => setNewStore({ ...newStore, ownerPhone: e.target.value })} />
              </div>
            </div>
            {createError ? <p className="text-sm" style={{ color: 'var(--error)' }}>{createError}</p> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="button" variant="outline" onClick={() => setShowAddStore(false)}>Cancel</Button>
              <Button type="submit" size="lg" disabled={isCreatingStore} style={{ marginLeft: '8px' }}>
                {isCreatingStore ? 'Creating...' : 'Create Store'}
              </Button>
            </div>
          </form>
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