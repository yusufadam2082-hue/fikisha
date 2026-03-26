import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { merchantFetch } from './merchantApi';

interface ReviewItem {
  id: string;
  orderNumber?: string | null;
  rating: number;
  ratingComment?: string | null;
  merchantResponse?: string | null;
  createdAt: string;
  customer?: { name?: string | null };
}

export function MerchantReviews() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await merchantFetch<ReviewItem[]>('/api/merchant/reviews');
      setReviews(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const saveResponse = async (orderId: string) => {
    const response = drafts[orderId]?.trim();
    if (!response) return;

    try {
      await merchantFetch<{ id: string; merchantResponse: string }>(`/api/merchant/reviews/${orderId}/respond`, {
        method: 'PUT',
        body: JSON.stringify({ response }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save response');
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-h1" style={{ marginBottom: '16px' }}>Customer Reviews</h1>
      {error && <p style={{ color: 'var(--error)', marginBottom: '10px' }}>{error}</p>}

      <div style={{ display: 'grid', gap: '12px' }}>
        {reviews.length === 0 && <Card style={{ padding: '16px' }}><p className="text-sm text-muted">No reviews yet.</p></Card>}
        {reviews.map((review) => (
          <Card key={review.id} style={{ padding: '16px' }}>
            <div className="flex-between" style={{ marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
              <strong>{review.customer?.name || 'Customer'}</strong>
              <span className="text-sm text-muted">{new Date(review.createdAt).toLocaleString()}</span>
            </div>
            <p style={{ marginBottom: '6px' }}>Rating: {review.rating}/5</p>
            <p className="text-sm text-muted" style={{ marginBottom: '10px' }}>{review.ratingComment || 'No comment provided.'}</p>

            {review.merchantResponse ? (
              <p className="text-sm"><strong>Response:</strong> {review.merchantResponse}</p>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="input-field"
                  placeholder="Write your response"
                  value={drafts[review.id] || ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                />
                <Button onClick={() => void saveResponse(review.id)}>Send</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
