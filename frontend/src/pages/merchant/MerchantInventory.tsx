import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { merchantFetch } from './merchantApi';

interface InventoryItem {
  id: string;
  name: string;
  category?: string | null;
  available: boolean;
  quantityAvailable?: number | null;
  lowStockThreshold?: number | null;
  price: number;
}

export function MerchantInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  async function load() {
    try {
      setError('');
      const payload = await merchantFetch<InventoryItem[]>('/api/merchant/inventory');
      setItems(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const lowStockCount = useMemo(
    () => items.filter((item) => (item.quantityAvailable ?? 0) <= (item.lowStockThreshold ?? 5)).length,
    [items]
  );

  const toggleSelection = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const bulkSetAvailability = async (available: boolean) => {
    if (selected.length === 0) return;
    try {
      await merchantFetch<{ updated: number }>('/api/merchant/inventory/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ productIds: selected, updates: { available } }),
      });
      setSelected([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    }
  };

  if (loading) return <div>Loading inventory...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '16px', gap: '8px', flexWrap: 'wrap' }}>
        <h1 className="text-h1">Inventory</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={() => void bulkSetAvailability(true)} disabled={selected.length === 0}>Mark In Stock</Button>
          <Button variant="outline" onClick={() => void bulkSetAvailability(false)} disabled={selected.length === 0}>Mark Out of Stock</Button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}

      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <p className="text-sm text-muted">{items.length} products tracked | {lowStockCount} low stock</p>
      </Card>

      <Card style={{ padding: '0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px' }}></th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Product</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Qty</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Threshold</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Availability</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}>
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelection(item.id)} />
                  </td>
                  <td style={{ padding: '12px' }}>{item.name}</td>
                  <td style={{ padding: '12px' }}>{item.quantityAvailable ?? '-'}</td>
                  <td style={{ padding: '12px' }}>{item.lowStockThreshold ?? 5}</td>
                  <td style={{ padding: '12px' }}>{item.available ? 'In stock' : 'Out of stock'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
