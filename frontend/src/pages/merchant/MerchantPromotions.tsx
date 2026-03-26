import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { merchantFetch } from './merchantApi';

interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  active: boolean;
  discountType?: string | null;
  discountValue?: number | null;
}

export function MerchantPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountValue, setDiscountValue] = useState('');
  const [error, setError] = useState('');

  async function loadPromotions() {
    try {
      const data = await merchantFetch<Promotion[]>('/api/merchant/promotions');
      setPromotions(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions');
    }
  }

  useEffect(() => {
    void loadPromotions();
  }, []);

  const createPromotion = async () => {
    if (!title.trim() || !subtitle.trim()) return;
    try {
      await merchantFetch<Promotion>('/api/merchant/promotions', {
        method: 'POST',
        body: JSON.stringify({
          title,
          subtitle,
          discountType,
          discountValue: discountValue ? Number(discountValue) : null,
          active: true,
        }),
      });
      setTitle('');
      setSubtitle('');
      setDiscountValue('');
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promotion');
    }
  };

  const toggleActive = async (promo: Promotion) => {
    try {
      await merchantFetch<Promotion>(`/api/merchant/promotions/${promo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !promo.active }),
      });
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update promotion');
    }
  };

  const removePromotion = async (id: string) => {
    try {
      await merchantFetch<{ success: boolean }>(`/api/merchant/promotions/${id}`, { method: 'DELETE' });
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete promotion');
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Promotions</h1>
      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}

      <Card style={{ padding: '16px', marginBottom: '16px' }}>
        <h3 className="text-h3" style={{ marginBottom: '12px' }}>Create Promotion</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px 160px auto', gap: '8px' }}>
          <input className="input-field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input-field" placeholder="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          <select className="input-field" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
            <option value="PERCENT">Percent</option>
            <option value="FLAT">Flat</option>
          </select>
          <input className="input-field" placeholder="Value" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
          <Button onClick={() => void createPromotion()}>Create</Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: '12px' }}>
        {promotions.map((promo) => (
          <Card key={promo.id} style={{ padding: '16px' }}>
            <div className="flex-between" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <h3 className="text-h3">{promo.title}</h3>
                <p className="text-sm text-muted">{promo.subtitle}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="outline" onClick={() => void toggleActive(promo)}>{promo.active ? 'Deactivate' : 'Activate'}</Button>
                <Button variant="outline" onClick={() => void removePromotion(promo.id)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
