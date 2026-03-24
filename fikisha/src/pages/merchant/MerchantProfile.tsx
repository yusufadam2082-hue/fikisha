import { useState, useEffect } from 'react';
import { useAuth, updateProfile } from '../../context/AuthContext';
import { useStoreContext, type Store } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Store as StoreIcon, ShoppingBag, Edit2, X } from 'lucide-react';

type TabId = 'store' | 'account' | 'orders';

export function MerchantProfile() {
  const { user, updateUser } = useAuth();
  const { stores, updateStore } = useStoreContext();
  const store = stores.find(s => s.id === user?.storeId);
  
  const [activeTab, setActiveTab] = useState<TabId>('store');
  const [isEditing, setIsEditing] = useState(false);
  const [storeForm, setStoreForm] = useState<Partial<Store>>({});
  const [accountForm, setAccountForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: ''
  });
  const [storeMessage, setStoreMessage] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    if (store) {
      setStoreForm(store);
    }
  }, [store]);

  useEffect(() => {
    if (user) {
      setAccountForm({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        password: ''
      });
    }
  }, [user]);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    setStoreMessage('');
    setIsSavingStore(true);
    
    try {
      await updateStore(store.id, storeForm);
      setStoreMessage('Store profile updated.');
      setIsEditing(false);
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Failed to update store profile');
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMessage('');
    setIsSavingAccount(true);

    try {
      const updatedUser = await updateProfile({
        name: accountForm.name,
        username: accountForm.username,
        email: accountForm.email || null,
        phone: accountForm.phone || null,
        ...(accountForm.password ? { password: accountForm.password } : {})
      });

      updateUser(updatedUser);
      setAccountForm((currentForm) => ({ ...currentForm, password: '' }));
      setAccountMessage('Merchant account updated.');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Failed to update merchant account');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const tabs = [
    { id: 'store' as TabId, label: 'Store Profile', icon: StoreIcon },
    { id: 'account' as TabId, label: 'Account', icon: User },
    { id: 'orders' as TabId, label: 'Orders', icon: ShoppingBag },
  ];

  if (!store && !isEditing) {
    return (
      <div className="container" style={{ padding: '48px', textAlign: 'center' }}>
        <p className="text-muted">Loading store profile...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1000px', paddingTop: '32px' }}>
      <h1 className="text-h1" style={{ marginBottom: '32px' }}>Merchant Dashboard</h1>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Sidebar */}
        <div style={{ width: '240px', flexShrink: 0 }}>
          <Card style={{ padding: '16px', position: 'sticky', top: '100px' }}>
            {/* Store Stats */}
            {store && (
              <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <img src={store.image} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{store.name}</p>
                    <p className="text-sm text-muted">{store.category}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{store.products?.length || 0}</p>
                    <p className="text-sm text-muted">Products</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{store.rating}</p>
                    <p className="text-sm text-muted">Rating</p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      color: isActive ? 'white' : 'var(--text-main)',
                      cursor: 'pointer', fontWeight: 600, textAlign: 'left',
                      transition: 'all var(--transition-smooth)',
                    }}
                  >
                    <Icon size={20} />{tab.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          {/* Store Tab */}
          {activeTab === 'store' && store && (
            <Card style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="text-h2">Store Profile</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <><X size={16} /> Cancel</> : <><Edit2 size={16} /> Edit</>}
                </Button>
              </div>
              
              <form onSubmit={handleSaveStore} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Store Name</label>
                    <input 
                      className="input-field" 
                      value={storeForm.name || ''} 
                      onChange={e => setStoreForm({...storeForm, name: e.target.value})} 
                      disabled={!isEditing}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Category</label>
                    <input 
                      className="input-field" 
                      value={storeForm.category || ''} 
                      onChange={e => setStoreForm({...storeForm, category: e.target.value})} 
                      disabled={!isEditing}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Delivery Fee (KES)</label>
                    <input 
                      className="input-field" type="number" step="0.01"
                      value={storeForm.deliveryFee || 0} 
                      onChange={e => setStoreForm({...storeForm, deliveryFee: parseFloat(e.target.value) || 0})} 
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Delivery Time</label>
                    <input 
                      className="input-field"
                      value={storeForm.time || ''} 
                      onChange={e => setStoreForm({...storeForm, time: e.target.value})} 
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Phone</label>
                    <input 
                      className="input-field"
                      value={storeForm.phone || ''} 
                      onChange={e => setStoreForm({...storeForm, phone: e.target.value})} 
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Address</label>
                  <input 
                    className="input-field"
                    value={storeForm.address || ''} 
                    onChange={e => setStoreForm({...storeForm, address: e.target.value})} 
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Banner Image URL</label>
                  <input 
                    className="input-field" 
                    value={storeForm.image || ''} 
                    onChange={e => setStoreForm({...storeForm, image: e.target.value})} 
                    disabled={!isEditing}
                  />
                  {storeForm.image && (
                    <div style={{ marginTop: '16px', height: '150px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <img src={storeForm.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Description</label>
                  <textarea 
                    className="input-field" rows={3}
                    value={storeForm.description || ''} 
                    onChange={e => setStoreForm({...storeForm, description: e.target.value})} 
                    disabled={!isEditing}
                  />
                </div>

                {storeMessage && (
                  <p className="text-sm" style={{ color: storeMessage.includes('updated') ? 'var(--success, #16a34a)' : 'var(--error)' }}>
                    {storeMessage}
                  </p>
                )}

                {isEditing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="submit" disabled={isSavingStore}>
                      {isSavingStore ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </form>
            </Card>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <Card style={{ padding: '32px' }}>
              <h2 className="text-h2" style={{ marginBottom: '24px' }}>Account Details</h2>
              <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Owner Name</label>
                    <input
                      className="input-field"
                      value={accountForm.name}
                      onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Username</label>
                    <input
                      className="input-field"
                      value={accountForm.username}
                      onChange={e => setAccountForm({ ...accountForm, username: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Email</label>
                    <input
                      className="input-field"
                      type="email"
                      value={accountForm.email}
                      onChange={e => setAccountForm({ ...accountForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Phone</label>
                    <input
                      className="input-field"
                      value={accountForm.phone}
                      onChange={e => setAccountForm({ ...accountForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>New Password</label>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="Leave blank to keep current password"
                    value={accountForm.password}
                    onChange={e => setAccountForm({ ...accountForm, password: e.target.value })}
                  />
                </div>

                {accountMessage && (
                  <p className="text-sm" style={{ color: accountMessage.includes('updated') ? 'var(--success, #16a34a)' : 'var(--error)' }}>
                    {accountMessage}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" disabled={isSavingAccount}>
                    {isSavingAccount ? 'Saving...' : 'Save Account'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Orders Tab Placeholder */}
          {activeTab === 'orders' && (
            <Card style={{ padding: '32px', textAlign: 'center' }}>
              <ShoppingBag size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <h2 className="text-h2" style={{ marginBottom: '8px' }}>Orders</h2>
              <p className="text-muted">View your orders in the Orders section</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
