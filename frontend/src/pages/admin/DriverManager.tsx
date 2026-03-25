import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Plus, Trash2, Edit2, Navigation } from 'lucide-react';
import { formatKES } from '../../utils/currency';

export function DriverManager() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [viewingOrdersFor, setViewingOrdersFor] = useState<string | null>(null);
  const [driverOrders, setDriverOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/drivers');
      if (res.ok && res.status !== 204) setDrivers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdd = () => {
    setEditingDriver(null);
    setName(''); setPhone(''); setVehicle(''); setUsername(''); setPassword('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (driver: any) => {
    setEditingDriver(driver);
    setName(driver.name); setPhone(driver.phone); setVehicle(driver.vehicle);
    setUsername(driver.username); setPassword(driver.password);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = { name, phone, vehicle, username, password };
      let res;
      if (editingDriver) {
        res = await fetch(`/api/drivers/${editingDriver.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/drivers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        setIsModalOpen(false);
        fetchDrivers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;
    try {
      const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDrivers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewOrders = async (driverId: string) => {
    try {
      const res = await fetch(`/api/orders?driverId=${driverId}`);
      if (res.ok && res.status !== 204) {
        const orders = await res.json();
        setDriverOrders(orders.filter((o: any) => o.status === 'delivered')); // only show historical completed
        setViewingOrdersFor(driverId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-h1">Driver Management</h1>
          <p className="text-muted">Add, remove, and manage delivery personnel.</p>
        </div>
        <Button onClick={handleOpenAdd}><Plus size={18} /> Add New Driver</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {drivers.map(driver => (
          <Card key={driver.id} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} />
              </div>
              <div>
                <h3 className="text-h3">{driver.name}</h3>
                <p className="text-sm text-muted">{driver.vehicle}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div className="flex-between">
                <span className="text-sm font-semibold text-muted">Phone</span>
                <span className="text-sm">{driver.phone}</span>
              </div>
              <div className="flex-between">
                <span className="text-sm font-semibold text-muted">Portal Username</span>
                <span className="text-sm">{driver.username}</span>
              </div>
              <div className="flex-between">
                <span className="text-sm font-semibold text-muted">Portal Password</span>
                <span className="text-sm" style={{ fontFamily: 'monospace' }}>{driver.password}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="outline" onClick={() => handleViewOrders(driver.id)} style={{ flex: 1 }}><Navigation size={16} /> Deliveries</Button>
              <Button variant="outline" onClick={() => handleOpenEdit(driver)} style={{ width: '40px', padding: '0', display: 'flex', justifyContent: 'center' }}><Edit2 size={16} /></Button>
              <Button variant="outline" onClick={() => handleDelete(driver.id)} style={{ width: '40px', padding: '0', display: 'flex', justifyContent: 'center', color: 'var(--error)' }}><Trash2 size={16} /></Button>
            </div>
          </Card>
        ))}
      </div>

      {drivers.length === 0 && (
        <Card style={{ padding: '64px', textAlign: 'center' }}>
          <p className="text-body text-muted">No drivers registered yet.</p>
        </Card>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card style={{ padding: '32px', width: '100%', maxWidth: '500px' }} className="animate-fade-in">
            <h2 className="text-h2" style={{ marginBottom: '24px' }}>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Full Name</label>
                <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Smith" />
              </div>
              <div>
                <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Phone Number</label>
                <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. (555) 123-4567" />
              </div>
              <div>
                <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Vehicle Type / Plate</label>
                <input className="input-field" value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="e.g. Toyota Prius (ABC-123)" />
              </div>
              
              <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
              
              <div>
                <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Login Username</label>
                <input className="input-field" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold" style={{ marginBottom: '8px', display: 'block' }}>Login Password</label>
                <input className="input-field" value={password} onChange={e => setPassword(e.target.value)} type="text" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
              <Button style={{ flex: 1 }} onClick={handleSave}>Save Driver</Button>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {/* View Orders Modal */}
      {viewingOrdersFor && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card style={{ padding: '32px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
            <h2 className="text-h2" style={{ marginBottom: '8px' }}>Completed Deliveries</h2>
            <p className="text-sm text-muted" style={{ marginBottom: '24px' }}>Historical log of all orders successfully delivered by this driver.</p>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {driverOrders.length === 0 ? (
                <p className="text-center text-muted" style={{ padding: '32px 0' }}>No completed orders found.</p>
              ) : (
                driverOrders.map(order => (
                  <div key={order.id} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <div className="flex-between" style={{ marginBottom: '8px' }}>
                      <span className="font-semibold">Order {order.orderNumber || `FK-${String(order.id).replace(/-/g, '').slice(-6).toUpperCase()}`}</span>
                      <span className="text-sm text-muted">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-sm text-muted">Customer: {order.customerInfo?.name}</span>
                      <span className="font-semibold text-primary">{formatKES(Number(order.total || 0))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button onClick={() => setViewingOrdersFor(null)} style={{ marginTop: '24px' }} fullWidth>Close</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
