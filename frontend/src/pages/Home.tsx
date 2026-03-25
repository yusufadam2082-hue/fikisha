import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { ArrowRight, Clock, Star, X, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStoreContext } from '../context/StoreContext';
import { useSearch } from '../context/SearchContext';
import { formatKES } from '../utils/currency';
import { getAuthHeaders as buildAuthHeaders } from '../utils/authStorage';

interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string | null;
  bgColor: string;
  image: string | null;
}

interface AiRecommendation {
  id: string;
  name: string;
  price: number;
  image: string;
  storeId: string;
  storeName: string;
  reason: string;
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(true);
}

export function Home() {
  const { categories, stores } = useStoreContext();
  const { searchQuery } = useSearch();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);
  const [loadingAiRecommendations, setLoadingAiRecommendations] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const storesRef = useRef<HTMLElement>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nextSlide = useCallback(() => {
    setHeroIndex(i => (i + 1) % Math.max(1, promotions.length));
  }, [promotions.length]);

  const prevSlide = () => {
    setHeroIndex(i => (i - 1 + promotions.length) % promotions.length);
  };

  // Auto-advance carousel every 5 seconds when there are multiple promotions.
  useEffect(() => {
    if (promotions.length <= 1) return;
    heroTimerRef.current = setInterval(nextSlide, 5000);
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [promotions.length, nextSlide]);

  // Fetch active promotions from the public endpoint.
  useEffect(() => {
    fetch('/api/promotions')
      .then(r => r.ok ? r.json() : [])
      .then((data: Promotion[]) => { if (Array.isArray(data)) setPromotions(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchAiRecommendations = async () => {
      try {
        setLoadingAiRecommendations(true);
        const response = await fetch('/api/ai/recommendations?limit=6', {
          headers: getAuthHeaders()
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!Array.isArray(data?.recommendations)) {
          return;
        }

        const normalized = data.recommendations
          .filter((item: Partial<AiRecommendation>) => item.id && item.storeId)
          .map((item: Partial<AiRecommendation>) => ({
            id: String(item.id),
            name: String(item.name || 'Recommended item'),
            price: Number(item.price || 0),
            image: String(item.image || ''),
            storeId: String(item.storeId),
            storeName: String(item.storeName || 'Popular store'),
            reason: String(item.reason || 'Popular in your area')
          }));

        setAiRecommendations(normalized);
      } catch {
        // Keep homepage functional if recommendation API is unavailable.
      } finally {
        setLoadingAiRecommendations(false);
      }
    };

    fetchAiRecommendations();
  }, []);

  const searchLower = searchQuery.toLowerCase().trim();

  const filteredBySearch = searchLower
    ? stores.filter(store =>
        store.name.toLowerCase().includes(searchLower) ||
        store.category.toLowerCase().includes(searchLower) ||
        store.products?.some(product => product.name.toLowerCase().includes(searchLower))
      )
    : stores;

  // Issue 5: sort by rating descending
  const filteredStores = (selectedCategory
    ? filteredBySearch.filter(store => store.category === selectedCategory)
    : filteredBySearch
  ).slice().sort((a, b) => b.rating - a.rating);

  return (
    <div className="container" style={{ padding: '0 24px' }}>

      {/* Hero / Promotions Section */}
      {promotions.length > 0 ? (
        <section style={{ position: 'relative', marginBottom: '0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Slide */}
          {promotions.map((promo, idx) => {
            const handleCtaClick = () => {
              if (promo.ctaLink) {
                window.open(promo.ctaLink, '_blank', 'noopener,noreferrer');
              } else {
                storesRef.current?.scrollIntoView({ behavior: 'smooth' });
              }
            };
            return (
              <div
                key={promo.id}
                className="animate-fade-in"
                style={{
                  display: idx === heroIndex ? 'flex' : 'none',
                  alignItems: 'center',
                  minHeight: '260px',
                  padding: '48px 40px',
                  background: promo.image
                    ? `linear-gradient(rgba(0,0,0,0.48), rgba(0,0,0,0.48)), url(${promo.image}) center/cover`
                    : promo.bgColor,
                  color: '#fff',
                  position: 'relative',
                }}
              >
                <div style={{ maxWidth: '560px', zIndex: 2 }}>
                  <h1 className="text-h1" style={{ marginBottom: '12px', color: '#fff' }}>{promo.title}</h1>
                  <p className="text-h3" style={{ opacity: 0.9, marginBottom: '28px', fontWeight: 400, color: '#fff' }}>{promo.subtitle}</p>
                  <button
                    onClick={handleCtaClick}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      background: 'rgba(255,255,255,0.2)', color: '#fff',
                      border: '2px solid rgba(255,255,255,0.6)', borderRadius: '999px',
                      padding: '12px 28px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {promo.ctaText} <ArrowRight size={18} />
                  </button>
                </div>
                {/* Decorative circle */}
                <div style={{
                  position: 'absolute', right: '-5%', top: '-20%',
                  width: '400px', height: '400px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.07)', zIndex: 1,
                }} className="hidden-mobile" />
              </div>
            );
          })}

          {/* Prev / Next arrows */}
          {promotions.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                style={{
                  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%',
                  color: '#fff', width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', zIndex: 10,
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextSlide}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%',
                  color: '#fff', width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', zIndex: 10,
                }}
              >
                <ChevronRight size={20} />
              </button>
              {/* Dot indicators */}
              <div style={{
                position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: '6px', zIndex: 10,
              }}>
                {promotions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setHeroIndex(idx)}
                    style={{
                      width: idx === heroIndex ? '20px' : '8px', height: '8px',
                      borderRadius: '999px', border: 'none', cursor: 'pointer',
                      background: idx === heroIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                      transition: 'all 0.3s ease', padding: 0,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        /* Fallback static hero when no promotions are configured */
        <section className="animate-fade-in hero-section">
          <div style={{ maxWidth: '600px', position: 'relative', zIndex: 2 }}>
            <h1 className="text-h1" style={{ marginBottom: '16px' }}>Cravings? Groceries? Anything, delivered.</h1>
            <p className="text-h3" style={{ opacity: 0.9, marginBottom: '32px', fontWeight: 400 }}>Get exactly what you need, exactly when you need it.</p>
            <button
              onClick={() => storesRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="hero-btn"
            >
              Order now <ArrowRight size={18} />
            </button>
          </div>
          <div style={{
            position: 'absolute', right: '-10%', top: '-20%',
            width: '500px', height: '500px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', zIndex: 1
          }} className="hidden-mobile" />
        </section>
      )}

      {/* Categories */}
      <section style={{ marginBottom: '48px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 className="text-h2">What do you need?</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className="flex-center"
              hoverable
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
              style={{
                flexDirection: 'row', padding: '12px 16px', gap: '12px',
                background: selectedCategory === cat.name ? 'rgba(255, 90, 95, 0.1)' : 'var(--surface)',
                borderColor: selectedCategory === cat.name ? 'var(--primary)' : 'transparent',
                cursor: 'pointer', borderRadius: '40px', alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{cat.image}</span>
              <span className="text-h3" style={{ color: selectedCategory === cat.name ? 'var(--primary)' : 'inherit', fontSize: '0.9rem' }}>
                {cat.name}
              </span>
            </Card>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h2 className="text-h2">AI Picks For You</h2>
          <span className="text-sm text-muted">Personalized from your recent activity</span>
        </div>

        {loadingAiRecommendations ? (
          <div className="text-muted">Loading smart picks...</div>
        ) : aiRecommendations.length === 0 ? (
          <div className="text-muted">No personalized picks yet. Place an order and AI suggestions will improve.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {aiRecommendations.map((item) => (
              <Link key={item.id} to={`/customer/store/${item.storeId}`}>
                <Card style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ height: '140px', background: 'var(--surface-hover)' }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = '<div class="image-fallback">No Image</div>';
                          }
                        }}
                      />
                    ) : (
                      <div className="image-fallback">No Image</div>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <p className="text-sm" style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '6px' }}>{item.storeName}</p>
                    <h3 className="text-h3" style={{ fontSize: '1rem', marginBottom: '8px' }}>{item.name}</h3>
                    <p className="text-sm text-muted" style={{ marginBottom: '10px' }}>{item.reason}</p>
                    <p style={{ fontWeight: 700 }}>{formatKES(item.price)}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Issue 1: single store section (removed duplicate list view) */}
      {/* Issue 2: removed dead "See all" button */}
      <section ref={storesRef} style={{ marginBottom: '48px' }}>
        <div className="flex-between" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="text-h2">
              {selectedCategory ? `${selectedCategory} near you` : 'Popular near you'}
            </h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="btn-icon"
                style={{ background: 'var(--surface-hover)', padding: '4px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Issue 4: empty state */}
        {filteredStores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
            <Package size={48} style={{ opacity: 0.3, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
            <p className="text-h3" style={{ marginBottom: '8px' }}>No stores found</p>
            <p className="text-body">
              {searchQuery
                ? `No results for "${searchQuery}" â€” try a different search.`
                : 'No stores in this category yet.'}
            </p>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{ marginTop: '16px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '32px' }}>
            {filteredStores.map((place) => (
              <Link key={place.id} to={`/customer/store/${place.id}`}>
                <Card style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Issue 9: image fallback */}
                  <div style={{ height: '200px', width: '100%', overflow: 'hidden', background: 'var(--surface-hover)' }}>
                    <img
                      src={place.image}
                      alt={place.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { 
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          target.parentElement.innerHTML = '<div class="image-fallback">No Image</div>';
                        }
                      }}
                    />
                  </div>
                  <div style={{ padding: '24px' }}>
                    <div className="flex-between" style={{ marginBottom: '8px' }}>
                      <h3 className="text-h3">{place.name}</h3>
                      <div className="flex-center" style={{ gap: '4px', background: 'var(--surface-hover)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                        <Star size={16} color="var(--accent)" fill="var(--accent)" />
                        <span className="text-sm" style={{ fontWeight: 600 }}>{place.rating}</span>
                      </div>
                    </div>
                    <div className="flex-between text-muted text-sm">
                      <span>{place.category}</span>
                      <div className="flex-center" style={{ gap: '4px' }}>
                        <Clock size={16} />
                        <span>{place.time}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
