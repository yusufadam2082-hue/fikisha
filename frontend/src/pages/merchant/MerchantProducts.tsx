import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext, type Product } from '../../context/StoreContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Edit2, Package, Save, X, Upload } from 'lucide-react';
import { formatKES } from '../../utils/currency';
import { compressImageToBase64 } from '../../utils/imageUpload';

export function MerchantProducts() {
  const { user } = useAuth();
  const { stores, addProduct, updateProduct } = useStoreContext();
  const store = stores.find(s => s.id === user?.storeId);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  
  // New Product Form
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', description: '', price: 0, image: '' });

  if (!store) return null;

  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setEditForm(product);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId || !store.id) return;
    try {
      await updateProduct(store.id, editingId, editForm);
      setEditingId(null);
      setEditForm({});
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNew = async () => {
    if (!store.id || !newProduct.name || !newProduct.price) return;
    try {
      await addProduct(store.id, newProduct as Omit<Product, 'id'>);
      setIsAdding(false);
      setNewProduct({ name: '', description: '', price: 0, image: '' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <h1 className="text-h1">My Menu</h1>
        <Button onClick={() => setIsAdding(true)}><Package size={18} /> Add Item</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        
        {isAdding && (
          <Card style={{ padding: '24px', border: '2px dashed var(--primary)' }}>
            <h3 className="text-h3" style={{ marginBottom: '16px' }}>New Menu Item</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                className="input-field" placeholder="Item Name" 
                value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
              />
              <input 
                className="input-field" placeholder="Price in KES (e.g. 250.00)" type="number" step="0.01"
                value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} 
              />
              <input 
                className="input-field" placeholder="Description" 
                value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  className="input-field" placeholder="Image URL (or upload ->)" 
                  value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                  style={{ flex: 1 }}
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-hover)', padding: '0 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', gap: '8px', fontWeight: 600 }}>
                  <Upload size={16} /> Upload
                  <input 
                    type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        try {
                          const base64 = await compressImageToBase64(e.target.files[0]);
                          setNewProduct({...newProduct, image: base64});
                        } catch (err) {
                          console.error('Upload failed', err);
                        }
                      }
                    }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <Button onClick={handleSaveNew} style={{ flex: 1 }}>Save</Button>
                <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {store.products.map((product: Product) => {
          const isEditing = editingId === product.id;

          return (
            <Card key={product.id} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ height: '180px', background: '#eee' }}>
                <img src={isEditing ? editForm.image : product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <input 
                      className="input-field" value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})} 
                    />
                    <input 
                      className="input-field" type="number" step="0.01" value={editForm.price} 
                      onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})} 
                    />
                    <textarea 
                      className="input-field" value={editForm.description} rows={2}
                      onChange={e => setEditForm({...editForm, description: e.target.value})} 
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        className="input-field" placeholder="Image URL (or upload ->)" value={editForm.image} 
                        onChange={e => setEditForm({...editForm, image: e.target.value})} 
                        style={{ flex: 1 }}
                      />
                      <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-hover)', padding: '0 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', gap: '8px', fontWeight: 600 }}>
                        <Upload size={16} /> Upload
                        <input 
                          type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              try {
                                const base64 = await compressImageToBase64(e.target.files[0]);
                                setEditForm({...editForm, image: base64});
                              } catch (err) {
                                console.error('Upload failed', err);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 className="text-h3" style={{ fontSize: '1.25rem' }}>{product.name}</h3>
                      <span className="font-semibold text-primary">{formatKES(product.price)}</span>
                    </div>
                    <p className="text-sm text-muted">{product.description}</p>
                  </div>
                )}
                
                <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
                  {isEditing ? (
                    <>
                      <Button onClick={handleSaveEdit} style={{ flex: 1 }}><Save size={16} /> Save</Button>
                      <Button variant="outline" onClick={handleCancelEdit} style={{ padding: '0 12px' }}><X size={16} /></Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => handleEditClick(product)} style={{ width: '100%' }}>
                      <Edit2 size={16} /> Edit Item
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
