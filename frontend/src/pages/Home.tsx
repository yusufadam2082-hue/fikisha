import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock3,
  MapPin,
  Navigation,
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

interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string | null;
  bgColor: string;
  image: string | null;
}

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
  const { activeLocation, openLocationSelector } = useLocation();
  const storesRef = useRef<HTMLElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [storeQuotes, setStoreQuotes] = useState<Record<string, DeliveryQuote>>({});

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
    fetch(apiUrl('/api/promotions'))
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Promotion[]) => {
        if (Array.isArray(data)) {
          setPromotions(data);
        }
      })
      .catch(() => {});
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
        .sort((a, b) => b.rating - a.rating)
        .filter((store) => {
          if (!activeLocation || Object.keys(storeQuotes).length === 0) return true;
          const quote = storeQuotes[store.id];
          if (!quote) return true;
          return quote.serviceable;
        }),
    [selectedCategory, filteredBySearch, activeLocation, storeQuotes]
  );

  const heroPromo = promotions[0];
  const rewardPromos = promotions.length > 0
    ? promotions
    : [
        {
          id: 'fallback-a',
          title: '50% Off First Order',
          subtitle: 'Use code MTAAEXPRESS50 today',
          ctaText: 'Claim Offer',
          ctaLink: null,
          bgColor: 'linear-gradient(160deg, #4b1810 0%, #a63400 100%)',
          image: null,
        },
        {
          id: 'fallback-b',
          title: 'Free Market Delivery',
          subtitle: 'Orders over KES 3,000 get zero delivery fee',
          ctaText: 'Explore Markets',
          ctaLink: null,
          bgColor: 'linear-gradient(160deg, #0c3b2a 0%, #006944 100%)',
          image: null,
        },
      ];

  return (
    <div className="customer-home-shell">
      <section
        className={`customer-hero${heroPromo?.image ? ' has-image' : ''}`}
        style={{
          background: heroPromo?.image
            ? `linear-gradient(102deg, rgba(24, 8, 4, 0.75), rgba(24, 8, 4, 0.25)), url(${heroPromo.image}) center/cover`
            : 'linear-gradient(125deg, #fff1ee 0%, #ffd6ca 52%, #ffe9e3 100%)',
        }}
      >
        <div className="customer-hero-copy">
          <p className="customer-hero-kicker">Premium speed, citywide reach</p>
          <h1>
            Fastest delivery in <span>your</span> city.
          </h1>
          <p>
            {heroPromo?.subtitle ||
              'From hot meals to groceries and pharmacies, Mtaaexpress brings your essentials to your door in minutes.'}
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

        <div className="customer-hero-badge" role="status" aria-live="polite">
          <button type="button" className="customer-hero-location" onClick={openLocationSelector}>
            {activeLocation ? <MapPin size={14} /> : <Navigation size={14} />}
            <span>{activeLocation ? activeLocation.label : 'Set delivery location'}</span>
          </button>
          <p>Most stores deliver in 15-35 minutes</p>
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
          {rewardPromos.map((promo) => (
            <article
              key={promo.id}
              className="reward-card"
              style={{
                background: promo.image
                  ? `linear-gradient(180deg, rgba(10, 8, 8, 0.15) 0%, rgba(10, 8, 8, 0.75) 100%), url(${promo.image}) center/cover`
                  : promo.bgColor,
              }}
            >
              <span className="reward-pill">Limited Time</span>
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
            <p>{filteredStores.length} options available now</p>
          </div>
          <button type="button" className="location-filter" onClick={openLocationSelector}>
            {activeLocation ? <MapPin size={14} /> : <Navigation size={14} />}
            <span>{activeLocation ? activeLocation.label : 'Set location'}</span>
          </button>
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
