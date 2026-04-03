import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LocationPickerMap } from '../components/ui/LocationPickerMap';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { User, MapPin, CreditCard, ShoppingBag, Plus, Trash2, Edit2, Save, X, Mail, Phone, Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatKES } from '../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../utils/authStorage';
import { apiUrl } from '../utils/apiUrl';

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  isDefault: boolean;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
  phoneNumber?: string;
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  paymentSettled?: boolean;
  total: number;
  createdAt: string;
  deliveryOtp?: string | null;
  deliveryOtpVerified?: boolean;
  store?: { name: string };
  items?: Array<{ name?: string; product?: { name: string } }>;
}

const getAddressStorageKey = (userId?: string) => `mtaaexpress_addresses:${userId || 'guest'}`;
const getPaymentStorageKey = (userId?: string) => `mtaaexpress_payment_methods:${userId || 'guest'}`;

function readStoredAddresses(userId?: string): Address[] {
  const raw = localStorage.getItem(getAddressStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Address[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredPayments(userId?: string): PaymentMethod[] {
  const raw = localStorage.getItem(getPaymentStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PaymentMethod[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(true);
}

const STATUS_COLOR: Record<string, string> = {
  DELIVERED:        '#16a34a',
  DRIVER_ACCEPTED:  '#4f46e5',
  ASSIGNED:         '#2563eb',
  IN_TRANSIT:       '#a63400',
  ON_THE_WAY:       '#a63400',
  OUT_FOR_DELIVERY: '#a63400',
  PREPARING:        '#d97706',
  READY_FOR_PICKUP: '#d97706',
  CONFIRMED:        '#834c48',
  PENDING:          '#834c48',
  CANCELLED:        '#DC2626',
  CANCELED:         '#DC2626',
};

export function CustomerProfile() {
  // Issue 15: initialise from auth user instead of hardcoded data
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const { deliveryAddress, setDeliveryAddress } = useLocation();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'account' | 'addresses' | 'payments' | 'orders'>('account');
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  const [profile, setProfile] = useState({
    name:     user?.name     || user?.username || '',
    username: user?.username || '',
    email:    user?.email    || '',
    phone:    user?.phone    || '',
    avatar:   '',
  });

  // Keep profile display in sync if the auth user is updated from elsewhere (e.g., token refresh).
  useEffect(() => {
    setProfile(p => ({
      ...p,
      name:     user?.name     || user?.username || p.name,
      username: user?.username || p.username,
      email:    user?.email    || p.email,
      phone:    user?.phone    || p.phone,
    }));
  }, [user]);

  const [addresses, setAddresses] = useState<Address[]>([]);

  const [payments, setPayments] = useState<PaymentMethod[]>([]);

  const [editedProfile, setEditedProfile] = useState(profile);
  // Keep editedProfile base in sync with profile when not actively editing.
  useEffect(() => {
    if (!isEditing) setEditedProfile(profile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);
  const [newAddress, setNewAddress] = useState({ label: '', street: '', city: '' });
  // Issue 18: card number field instead of asking for last 4 directly
  const [newPayment, setNewPayment] = useState({ type: 'Visa', cardNumber: '', expiry: '', phoneNumber: '' });

  const isMpesaPaymentType = (type: string) => {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('mpesa') || normalized.includes('m-pesa') || normalized.includes('mobile money');
  };

  const formatMpesaPhone = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    if (digits.startsWith('254')) {
      return digits;
    }

    if (digits.startsWith('0')) {
      return `254${digits.slice(1)}`;
    }

    if (digits.length === 9) {
      return `254${digits}`;
    }

    return digits;
  };

  const formatAddress = (address: Pick<Address, 'street' | 'city'>) => `${address.street}, ${address.city}`;

  const reverseGeocode = async (latitude: number, longitude: number) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
    if (!res.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await res.json();
    const road = data.address?.road || data.address?.suburb || data.address?.neighbourhood || 'Current Location';
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || data.address?.state || '';
    return {
      street: road,
      city: city || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    };
  };

  const getCurrentPosition = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported on this device/browser.', 'error');
      return;
    }

    if (!window.isSecureContext) {
      showToast('Location works only on HTTPS or localhost. Open the app from localhost and try again.', 'error');
      return;
    }

    setIsDetectingLocation(true);
    try {
      let position: GeolocationPosition;

      try {
        // First attempt with high accuracy for better address quality.
        position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      } catch {
        // Fallback attempt: lower accuracy but often succeeds faster on weak GPS.
        position = await getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000
        });
      }

      try {
        const resolved = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        setNewAddress((prev) => ({
          ...prev,
          label: prev.label || 'Current Location',
          street: resolved.street,
          city: resolved.city
        }));
        showToast('Location detected. Review and save your address.', 'success');
      } catch {
        setNewAddress((prev) => ({
          ...prev,
          label: prev.label || 'Current Location',
          street: 'Current Location',
          city: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`
        }));
        showToast('Location detected, but full address lookup failed. Coordinates were filled in.', 'info');
      }
    } catch (error) {
      const geoError = error as GeolocationPositionError;

      if (geoError?.code === geoError.PERMISSION_DENIED) {
        showToast('Location permission denied. Allow location access for this site and try again.', 'error');
      } else if (geoError?.code === geoError.TIMEOUT) {
        showToast('Location request timed out. Move to an open area and try again.', 'error');
      } else if (geoError?.code === geoError.POSITION_UNAVAILABLE) {
        showToast('Position unavailable. Check device GPS/network and try again.', 'error');
      } else {
        showToast('Unable to detect your location right now.', 'error');
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleMapLocationConfirm = async (coords: { lat: number; lng: number }) => {
    setIsMapPickerOpen(false);
    setIsDetectingLocation(true);
    try {
      const resolved = await reverseGeocode(coords.lat, coords.lng);
      setNewAddress((prev) => ({
        ...prev,
        label: prev.label || 'Pinned Location',
        street: resolved.street,
        city: resolved.city
      }));
      showToast('Location selected from map. Review and save your address.', 'success');
    } catch {
      setNewAddress((prev) => ({
        ...prev,
        label: prev.label || 'Pinned Location',
        street: 'Pinned Location',
        city: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      }));
      showToast('Map location selected, but full address lookup failed. Coordinates were filled in.', 'info');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Issue 16: fetch orders when the Orders tab becomes active
  useEffect(() => {
    if (activeTab !== 'orders') return;
    setOrdersLoading(true);
    fetch(apiUrl('/api/orders'), { headers: getAuthHeaders() })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [activeTab]);

  useEffect(() => {
    setAddresses(readStoredAddresses(user?.id));
    setPayments(readStoredPayments(user?.id));
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem(getAddressStorageKey(user?.id), JSON.stringify(addresses));
  }, [addresses, user?.id]);

  useEffect(() => {
    localStorage.setItem(getPaymentStorageKey(user?.id), JSON.stringify(payments));
  }, [payments, user?.id]);

  // Save profile updates using the authenticated user's own endpoint.
  const handleSaveProfile = async () => {
    try {
      const res = await fetch(apiUrl('/api/me'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name:     editedProfile.name,
          username: editedProfile.username || undefined,
          email:    editedProfile.email    || null,
          phone:    editedProfile.phone    || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateUser({
          name:     updated.name,
          username: updated.username,
          email:    updated.email,
          phone:    updated.phone,
        });
        showToast('Profile updated successfully', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save profile', 'error');
        return;
      }
    } catch {
      showToast('Could not reach the server. Check your connection.', 'error');
      return;
    }
    setProfile(editedProfile);
    setIsEditing(false);
  };

  // Issue 17: wire Change Photo to a hidden file input
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProfile(p => ({ ...p, avatar: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAddAddress = () => {
    if (newAddress.label && newAddress.street && newAddress.city) {
      const addr: Address = { id: Date.now().toString(), ...newAddress, isDefault: addresses.length === 0 };
      const nextAddresses = [...addresses, addr];
      setAddresses(nextAddresses);
      if (addr.isDefault) {
        setDeliveryAddress(formatAddress(addr));
      }
      setNewAddress({ label: '', street: '', city: '' });
      setIsAddingAddress(false);
      showToast('Address added', 'success');
    }
  };

  // Issue 18: extract last4 from full card number on save
  const handleAddPayment = () => {
    if (isMpesaPaymentType(newPayment.type)) {
      const normalizedPhone = formatMpesaPhone(newPayment.phoneNumber);
      if (normalizedPhone.length < 12) {
        showToast('Please enter a valid M-Pesa phone number', 'error');
        return;
      }

      const pay: PaymentMethod = {
        id: Date.now().toString(),
        type: 'M-Pesa',
        last4: normalizedPhone.slice(-4),
        expiry: 'Mobile Money',
        phoneNumber: normalizedPhone,
        isDefault: payments.length === 0,
      };
      setPayments([...payments, pay]);
      setNewPayment({ type: 'Visa', cardNumber: '', expiry: '', phoneNumber: '' });
      setIsAddingPayment(false);
      showToast('M-Pesa added', 'success');
      return;
    }

    const raw = newPayment.cardNumber.replace(/\s/g, '');
    if (raw.length < 4 || !newPayment.expiry) {
      showToast('Please enter a valid card number and expiry date', 'error');
      return;
    }
    const pay: PaymentMethod = {
      id: Date.now().toString(),
      type: newPayment.type,
      last4: raw.slice(-4),
      expiry: newPayment.expiry,
      isDefault: payments.length === 0,
    };
    setPayments([...payments, pay]);
    setNewPayment({ type: 'Visa', cardNumber: '', expiry: '', phoneNumber: '' });
    setIsAddingPayment(false);
    showToast('Card added', 'success');
  };

  const setDefaultAddress = (id: string) => {
    const nextAddresses = addresses.map(a => ({ ...a, isDefault: a.id === id }));
    setAddresses(nextAddresses);
    const selected = nextAddresses.find(a => a.id === id);
    if (selected) {
      setDeliveryAddress(formatAddress(selected));
      showToast('Delivery address updated.', 'success');
    }
  };
  const setDefaultPayment = (id: string) => setPayments(payments.map(p => ({ ...p, isDefault: p.id === id })));
  const deleteAddress    = (id: string) => setAddresses(addresses.filter(a => a.id !== id));
  const deletePayment    = (id: string) => setPayments(payments.filter(p => p.id !== id));

  const handleLogout = () => {
    logout();
    navigate('/customer/login');
  };

  // Issue 16: added 'orders' tab
  const tabs = [
    { id: 'account',  label: 'Account',  icon: User        },
    { id: 'addresses',label: 'Addresses',icon: MapPin      },
    { id: 'payments', label: 'Payments', icon: CreditCard  },
    { id: 'orders',   label: 'Orders',   icon: ShoppingBag },
  ] as const;

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <h1 className="text-h1" style={{ marginBottom: '32px' }}>My Profile</h1>

      {/* Issue 17: hidden file input wired to Change Photo button */}
      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handlePhotoChange} />

        {/* Issue 19: .profile-layout switches to column on mobile via CSS */}
      <div className="profile-layout">
        <div className="profile-sidebar">
          <Card style={{ padding: '16px', position: 'sticky', top: '100px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: isActive ? '#a63400' : 'transparent',
                      color: isActive ? 'white' : 'var(--text-main)',
                      cursor: 'pointer', fontWeight: 600, textAlign: 'left',
                      transition: 'all var(--transition-smooth)',
                    }}
                  >
                    <Icon size={20} />{tab.label}
                  </button>
                );
              })}

              {/* Mobile-visible logout button; desktop logout is in the Navbar */}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(220,38,38,0.25)',
                  background: 'rgba(220,38,38,0.06)',
                  color: '#DC2626',
                  cursor: 'pointer', fontWeight: 600, textAlign: 'left',
                  marginTop: '8px',
                  transition: 'all var(--transition-smooth)',
                  width: '100%',
                }}
              >
                <LogOut size={20} />Sign Out
              </button>
            </div>
          </Card>
        </div>

        <div style={{ flex: 1 }}>
          {/* ── Account tab ── */}
          {activeTab === 'account' && (
            <Card style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h2 className="text-h2">Account Details</h2>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => { setEditedProfile(profile); setIsEditing(true); }}>
                    <Edit2 size={16} /> Edit
                  </Button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditedProfile(profile); }}>
                      <X size={16} /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile}>
                      <Save size={16} /> Save
                    </Button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: '#a63400', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '2rem', fontWeight: 700,
                }}>
                  {profile.avatar
                    ? <img src={profile.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (profile.name || 'U').charAt(0).toUpperCase()
                  }
                </div>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>Profile Photo</p>
                  {/* Issue 17: wired */}
                  <Button variant="outline" size="sm" style={{ marginTop: '8px' }} onClick={() => fileInputRef.current?.click()}>Change Photo</Button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '24px' }}>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Full Name</label>
                  {isEditing
                    ? <input className="input-field" value={editedProfile.name} onChange={e => setEditedProfile({ ...editedProfile, name: e.target.value })} style={{ width: '100%' }} />
                    : <p style={{ fontSize: '1.1rem' }}>{profile.name || '-'}</p>
                  }
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Username</label>
                  {isEditing
                    ? <input className="input-field" placeholder="@username" value={editedProfile.username} onChange={e => setEditedProfile({ ...editedProfile, username: e.target.value })} style={{ width: '100%' }} />
                    : <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>@{profile.username || '-'}</p>
                  }
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</label>
                  {isEditing
                    ? <input type="email" className="input-field" value={editedProfile.email} onChange={e => setEditedProfile({ ...editedProfile, email: e.target.value })} style={{ width: '100%' }} />
                    : <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={18} color="var(--text-muted)" /><p>{profile.email || '-'}</p></div>
                  }
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</label>
                  {isEditing
                    ? <input type="tel" className="input-field" value={editedProfile.phone} onChange={e => setEditedProfile({ ...editedProfile, phone: e.target.value })} style={{ width: '100%' }} />
                    : <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={18} color="var(--text-muted)" /><p>{profile.phone || '-'}</p></div>
                  }
                </div>
              </div>
            </Card>
          )}

          {/* ── Addresses tab ── */}
          {activeTab === 'addresses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="text-h2">My Addresses</h2>
                <Button size="sm" onClick={() => setIsAddingAddress(true)}><Plus size={16} /> Add Address</Button>
              </div>

              {isAddingAddress && (
                <Card style={{ padding: '24px' }}>
                  <h3 className="text-h3" style={{ marginBottom: '16px' }}>Add New Address</h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Button type="button" variant="outline" onClick={handleUseCurrentLocation} disabled={isDetectingLocation}>
                        <MapPin size={16} /> {isDetectingLocation ? 'Detecting location...' : 'Use Current Location'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsMapPickerOpen(true)} disabled={isDetectingLocation}>
                        <MapPin size={16} /> Pick on Map
                      </Button>
                    </div>
                    <input className="input-field" placeholder="Label (e.g., Home, Work)" value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} />
                    <input className="input-field" placeholder="Street Address" value={newAddress.street} onChange={e => setNewAddress({ ...newAddress, street: e.target.value })} />
                    <input className="input-field" placeholder="City, State ZIP" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="outline" onClick={() => setIsAddingAddress(false)}>Cancel</Button>
                      <Button onClick={handleAddAddress}>Save Address</Button>
                    </div>
                  </div>
                </Card>
              )}

              {isMapPickerOpen && (
                <LocationPickerMap
                  onCancel={() => setIsMapPickerOpen(false)}
                  onConfirm={handleMapLocationConfirm}
                />
              )}

              {addresses.map(addr => (
                <Card key={addr.id} style={{ padding: '24px', position: 'relative' }}>
                  {addr.isDefault && (
                    <span style={{ position: 'absolute', top: '16px', right: '16px', background: '#a63400', color: 'white', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600 }}>Default</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={24} color="#a63400" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 className="text-h3" style={{ marginBottom: '4px' }}>{addr.label}</h3>
                      <p className="text-muted">{addr.street}</p>
                      <p className="text-muted">{addr.city}</p>
                    </div>
                  </div>
                  {deliveryAddress === formatAddress(addr) && (
                    <p className="text-sm" style={{ color: '#a63400', marginTop: '8px', fontWeight: 600 }}>
                      Currently used for delivery
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    {!addr.isDefault && (
                      <Button variant="outline" size="sm" onClick={() => setDefaultAddress(addr.id)}>Set as Default</Button>
                    )}
                    <Button variant="icon" size="sm" onClick={() => deleteAddress(addr.id)} style={{ color: '#DC2626' }}><Trash2 size={16} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Payments tab ── */}
          {activeTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="text-h2">Payment Methods</h2>
                <Button size="sm" onClick={() => setIsAddingPayment(true)}><Plus size={16} /> Add Payment Method</Button>
              </div>

              {isAddingPayment && (
                <Card style={{ padding: '24px' }}>
                  <h3 className="text-h3" style={{ marginBottom: '16px' }}>Add Payment Method</h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <select className="input-field" value={newPayment.type} onChange={e => setNewPayment({ ...newPayment, type: e.target.value })} style={{ width: '100%', paddingLeft: '20px' }}>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Amex">American Express</option>
                      <option value="M-Pesa">M-Pesa</option>
                    </select>
                    {isMpesaPaymentType(newPayment.type) ? (
                      <input
                        className="input-field"
                        placeholder="M-Pesa phone number"
                        maxLength={12}
                        value={newPayment.phoneNumber}
                        onChange={e => setNewPayment({ ...newPayment, phoneNumber: formatMpesaPhone(e.target.value).slice(0, 12) })}
                      />
                    ) : (
                      <>
                        <input
                          className="input-field"
                          placeholder="Card number"
                          maxLength={19}
                          value={newPayment.cardNumber}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                            setNewPayment({ ...newPayment, cardNumber: v.match(/.{1,4}/g)?.join(' ') || v });
                          }}
                        />
                        <input className="input-field" placeholder="Expiry (MM/YY)" maxLength={5} value={newPayment.expiry} onChange={e => setNewPayment({ ...newPayment, expiry: e.target.value })} />
                      </>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="outline" onClick={() => setIsAddingPayment(false)}>Cancel</Button>
                      <Button onClick={handleAddPayment}>{isMpesaPaymentType(newPayment.type) ? 'Save M-Pesa' : 'Save Card'}</Button>
                    </div>
                  </div>
                </Card>
              )}

              {payments.map(pay => (
                <Card key={pay.id} style={{ padding: '24px', position: 'relative' }}>
                  {pay.isDefault && (
                    <span style={{ position: 'absolute', top: '16px', right: '16px', background: '#a63400', color: 'white', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600 }}>Default</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ width: '64px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.75rem' }}>
                      {pay.type}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 className="text-h3" style={{ marginBottom: '4px' }}>
                        {isMpesaPaymentType(pay.type) ? `M-Pesa ${pay.phoneNumber || `**** ${pay.last4}`}` : `**** **** **** ${pay.last4}`}
                      </h3>
                      <p className="text-muted">{isMpesaPaymentType(pay.type) ? 'Pay via mobile money STK push' : `Expires ${pay.expiry}`}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    {!pay.isDefault && <Button variant="outline" size="sm" onClick={() => setDefaultPayment(pay.id)}>Set as Default</Button>}
                    <Button variant="icon" size="sm" onClick={() => deletePayment(pay.id)} style={{ color: '#DC2626' }}><Trash2 size={16} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Orders tab (issue 16) ── */}
          {activeTab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 className="text-h2">Order History</h2>
              {ordersLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading orders�</div>
              ) : orders.length === 0 ? (
                <Card style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ShoppingBag size={48} style={{ opacity: 0.2, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                  <p className="text-h3" style={{ marginBottom: '8px' }}>No orders yet</p>
                  <p className="text-body">Your order history will appear here.</p>
                </Card>
              ) : orders.map(order => (
                <Card key={order.id} style={{ padding: '20px' }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{order.store?.name || 'Order'}</p>
                      <p className="text-sm text-muted">{order.orderNumber || `FK-${String(order.id).replace(/-/g, '').slice(-6).toUpperCase()}`} | {new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, color: '#a63400' }}>{formatKES(Number(order.total))}</p>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: STATUS_COLOR[order.status] || 'var(--text-muted)', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                        {order.paymentSettled && order.status === 'DELIVERED' ? 'DELIVERED & SETTLED' : order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  {order.deliveryOtp && (
                    <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-hover)' }}>
                      <p className="text-sm" style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>
                        Delivery verification code
                      </p>
                      <p style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                        {order.deliveryOtp}
                        {order.deliveryOtpVerified ? ' (Verified)' : ' (Share with courier on delivery)'}
                      </p>
                    </div>
                  )}
                  {order.items && (
                    <p className="text-sm text-muted">
                      <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      {order.items.map(i => i.name || i.product?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
