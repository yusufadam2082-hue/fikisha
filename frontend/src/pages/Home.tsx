import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock3,
  Package,
  Pill,
  ShoppingBasket,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import { useStoreContext } from '../context/StoreContext';
import { useSearch } from '../context/SearchContext';
import { apiUrl } from '../utils/apiUrl';
import { useLocation, type DeliveryQuote } from '../context/LocationContext';
import './HomeRedesign.css';

interface RewardCard {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
}

interface PromotionItem {
  id: string;
  title: string;
  subtitle: string;
  image?: string | null;
  startsAt?: string | null;
}

const FALLBACK_REWARD_CARDS: RewardCard[] = [
  {
    id: 'reward-1',
    title: '50% Off First Order',
    subtitle: 'Use code: MTAAEXPRESS50',
    badge: 'Limited Time',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'reward-2',
    title: 'Free Market Delivery',
    subtitle: 'Orders over $30 get zero fees',
    badge: 'Fresh Pick',
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1400&q=80',
  },
];

function categoryVisual(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes('food') || normalized.includes('restaurant')) {
    return {
      icon: <UtensilsCrossed size={28} />,
      ghostIcon: <UtensilsCrossed size={80} />,
      bg: 'linear-gradient(135deg, #ffe1d6 0%, #ffd2c1 100%)',
      subtitle: 'Chef-made meals',
    };
  }
  if (normalized.includes('grocery') || normalized.includes('market')) {
    return {
      icon: <ShoppingBasket size={28} />,
      ghostIcon: <ShoppingBasket size={80} />,
      bg: 'linear-gradient(135deg, #dbf7e5 0%, #c7f2d6 100%)',
      subtitle: 'Fresh essentials',
    };
  }
  if (normalized.includes('pharmacy') || normalized.includes('medicine')) {
    return {
      icon: <Pill size={28} />,
      ghostIcon: <Pill size={80} />,
      bg: 'linear-gradient(135deg, #dceeff 0%, #cfe5ff 100%)',
      subtitle: 'Instant health care',
    };
  }
  return {
    icon: <Package size={28} />,
    ghostIcon: <Package size={80} />,
    bg: 'linear-gradient(135deg, #f0ece6 0%, #e7dfd5 100%)',
    subtitle: 'Fast local delivery',
  };
}

export function Home() {
  const { categories, stores } = useStoreContext();
  const { searchQuery } = useSearch();
  const { activeLocation } = useLocation();
  const storesRef = useRef<HTMLElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [merchantSort, setMerchantSort] = useState<'all' | 'fastest' | 'top-rated'>('all');
  const [storeQuotes, setStoreQuotes] = useState<Record<string, DeliveryQuote>>({});
  const [rewardCards, setRewardCards] = useState<RewardCard[]>(FALLBACK_REWARD_CARDS);

  useEffect(() => {
    if (!activeLocation || stores.length === 0) {
      setStoreQuotes({});
      return;
    }

    const controller = new AbortController();
    const fetchQuotes = async () => {
      const results: Record<string, DeliveryQuote> = {};
      await Promise.allSettled(
        stores.map(async (store) => {
          try {
            const params = new URLSearchParams({
              storeId: store.id,
              lat: activeLocation.latitude.toString(),
              lng: activeLocation.longitude.toString(),
              orderTotal: '0',
            });
            const res = await fetch(apiUrl(`/api/delivery/quote?${params}`), { signal: controller.signal });
            if (res.ok) {
              results[store.id] = (await res.json()) as DeliveryQuote;
            }
          } catch {
            // Soft failure for per-store quote requests.
          }
        })
      );

      if (!controller.signal.aborted) {
        setStoreQuotes(results);
      }
    };

    fetchQuotes();
    return () => controller.abort();
  }, [activeLocation, stores]);

  useEffect(() => {
    const controller = new AbortController();

    const loadPromotions = async () => {
      try {
        const response = await fetch(apiUrl('/api/promotions'), { signal: controller.signal });
        if (!response.ok) {
          return;
        }

        const promotions = (await response.json()) as PromotionItem[];
        if (!Array.isArray(promotions) || promotions.length === 0) {
          setRewardCards(FALLBACK_REWARD_CARDS);
          return;
        }

        const mapped: RewardCard[] = promotions.slice(0, 4).map((promotion) => ({
          id: promotion.id,
          title: promotion.title,
          subtitle: promotion.subtitle,
          badge: promotion.startsAt ? 'Scheduled' : 'Live Offer',
          image: promotion.image || 'https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?auto=format&fit=crop&w=1400&q=80',
        }));

        setRewardCards(mapped);
      } catch {
        if (!controller.signal.aborted) {
          setRewardCards(FALLBACK_REWARD_CARDS);
        }
      }
    };

    loadPromotions();
    return () => controller.abort();
  }, []);

  const searchLower = searchQuery.toLowerCase().trim();

  const filteredBySearch = useMemo(
    () =>
      searchLower
        ? stores.filter(
            (store) =>
              store.name.toLowerCase().includes(searchLower) ||
              store.category.toLowerCase().includes(searchLower) ||
              store.products?.some((product) => product.name.toLowerCase().includes(searchLower))
          )
        : stores,
    [searchLower, stores]
  );

  const filteredStores = useMemo(
    () =>
      (selectedCategory
        ? filteredBySearch.filter((store) => store.category === selectedCategory)
        : filteredBySearch
      )
        .slice()
        .sort((a, b) => {
          if (merchantSort === 'fastest') {
            const aTime = Number(String(a.time || '').match(/\d+/)?.[0] || 999);
            const bTime = Number(String(b.time || '').match(/\d+/)?.[0] || 999);
            return aTime - bTime;
          }

          if (merchantSort === 'top-rated') {
            return b.rating - a.rating;
          }

          return b.rating - a.rating;
        })
        .filter((store) => {
          if (!activeLocation || Object.keys(storeQuotes).length === 0) return true;
          const quote = storeQuotes[store.id];
          if (!quote) return true;
          return quote.serviceable;
        }),
    [selectedCategory, filteredBySearch, activeLocation, storeQuotes, merchantSort]
  );

  return (
    <div className="customer-home-shell">
      <section className="customer-hero">
        <div className="customer-hero-copy">
          <h1>
            Fastest delivery in <span>your</span> city.
          </h1>
          <p>
            From gourmet meals to emergency prescriptions,
            Mtaaexpress delivers excellence to your doorstep
            in 30 minutes.
          </p>
          <div className="customer-hero-actions">
            <button
              type="button"
              className="btn-explore"
              onClick={() => storesRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Explore Stores <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="btn-offers"
              onClick={() => document.getElementById('home-rewards')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Offers
            </button>
          </div>
        </div>

        <div className="customer-hero-media" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1400&q=80"
            alt=""
          />
        </div>
      </section>

      <section className="customer-section">
        <div className="section-headline">
          <h2>What can we bring you?</h2>
          <p>Tap a category to start your journey</p>
        </div>

        <div className="customer-categories-grid">
          {categories.map((cat) => {
            const visual = categoryVisual(cat.name);
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.id}
                type="button"
                className={`customer-category-card${isSelected ? ' selected' : ''}`}
                onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
              >
                <div className="category-icon" style={{ background: visual.bg }}>
                  {visual.icon}
                </div>
                <h3>{cat.name}</h3>
                <p>{visual.subtitle}</p>
                <span className="ghost-icon" aria-hidden="true">
                  {visual.ghostIcon}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="home-rewards" className="customer-section">
        <div className="section-headline">
          <h2>Exclusive Rewards</h2>
        </div>
        <div className="customer-rewards-row">
          {rewardCards.map((promo) => (
            <article
              key={promo.id}
              className="reward-card"
              style={{
                background: `linear-gradient(180deg, rgba(10, 8, 8, 0.15) 0%, rgba(10, 8, 8, 0.75) 100%), url(${promo.image}) center/cover`,
              }}
            >
              <span className={`reward-pill${promo.badge.toLowerCase() === 'fresh pick' ? ' fresh' : ''}`}>{promo.badge}</span>
              <h3>{promo.title}</h3>
              <p>{promo.subtitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section ref={storesRef} className="customer-section">
        <div className="customer-merchants-head">
          <div>
            <h2>{selectedCategory ? `${selectedCategory} near you` : 'Nearby Merchants'}</h2>
          </div>
          <div className="merchant-filter-pills" role="tablist" aria-label="Merchant sorting">
            <button type="button" className={`merchant-filter-pill${merchantSort === 'all' ? ' active' : ''}`} onClick={() => setMerchantSort('all')}>All</button>
            <button type="button" className={`merchant-filter-pill${merchantSort === 'fastest' ? ' active' : ''}`} onClick={() => setMerchantSort('fastest')}>Fastest</button>
            <button type="button" className={`merchant-filter-pill${merchantSort === 'top-rated' ? ' active' : ''}`} onClick={() => setMerchantSort('top-rated')}>Top Rated</button>
          </div>
        </div>

        {filteredStores.length === 0 ? (
          <div className="home-empty-state">
            <Package size={42} />
            <h3>No stores found</h3>
            <p>
              {searchQuery
                ? `No results for "${searchQuery}". Try another keyword.`
                : 'No stores in this category yet.'}
            </p>
          </div>
        ) : (
          <div className="customer-merchants-grid">
            {filteredStores.map((store) => {
              const quote = storeQuotes[store.id];
              return (
                <Link key={store.id} to={`/customer/store/${store.id}`} className="merchant-card-link">
                  <article className="merchant-card">
                    <div className="merchant-media">
                      <img
                        src={store.image}
                        alt={store.name}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="merchant-rating">
                        <Star size={12} fill="currentColor" />
                        <span>{store.rating.toFixed(1)}</span>
                      </div>
                      <div className="merchant-time">
                        <Clock3 size={12} />
                        <span>{store.time}</span>
                      </div>
                    </div>
                    <div className="merchant-content">
                      <div className="merchant-title-row">
                        <h3>{store.name}</h3>
                        <span className="merchant-fee">
                          {quote?.serviceable
                            ? quote.deliveryFee === 0
                              ? 'Free'
                              : `${quote.deliveryFee.toFixed(0)} KES`
                            : 'Fee varies'}
                        </span>
                      </div>
                      <p>{store.category}</p>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
