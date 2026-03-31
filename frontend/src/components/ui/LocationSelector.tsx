import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Bookmark, X, Trash2, Check } from 'lucide-react';
import { useLocation, type AppLocation, type AddressSearchResult } from '../../context/LocationContext';
import { LocationPickerMap } from './LocationPickerMap';

type Tab = 'current' | 'search' | 'map' | 'saved';

const ORANGE = '#a63400';
const ORANGE_BG = 'rgba(166, 52, 0, 0.08)';
const ORANGE_BORDER = 'rgba(166, 52, 0, 0.2)';
const BROWN_TEXT = '#4e211e';
const BROWN_MUTED = '#834c48';

export function LocationSelector() {
  const {
    activeLocation,
    setActiveLocation,
    savedLocations,
    removeSavedLocation,
    isLocating,
    useCurrentLocation,
    searchAddresses,
    isLocationSelectorOpen,
    closeLocationSelector,
  } = useLocation();

  const [tab, setTab] = useState<Tab>('current');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AddressSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saveCheckbox, setSaveCheckbox] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLocationSelectorOpen) {
      setTab('current');
      setGpsError(null);
      setSearchQuery('');
      setSearchResults([]);
      setSaveCheckbox(false);
      setShowMap(false);
    }
  }, [isLocationSelectorOpen]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAddresses(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 450);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, searchAddresses]);

  if (!isLocationSelectorOpen) return null;

  const handleUseGPS = async () => {
    setGpsError(null);
    try {
      const location = await useCurrentLocation();
      if (location) {
        setActiveLocation(location, saveCheckbox);
        closeLocationSelector();
      }
    } catch (err) {
      const msg = err instanceof GeolocationPositionError
        ? (err.code === 1 ? 'Location permission denied. Use the Search or Map tab instead.'
          : err.code === 2 ? 'Location unavailable. Check GPS settings.'
          : 'Location timed out. Try again.')
        : 'Unable to get your location.';
      setGpsError(msg);
    }
  };

  const handleSelectSearchResult = (result: AddressSearchResult) => {
    const location: AppLocation = {
      id: crypto.randomUUID(),
      label: result.label,
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
      source: 'SEARCH',
      isSaved: saveCheckbox,
      updatedAt: Date.now(),
    };
    setActiveLocation(location, saveCheckbox);
    closeLocationSelector();
  };

  const handleMapConfirm = async (coords: { lat: number; lng: number }) => {
    let label = 'Pinned location';
    let address = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
        { headers: { 'User-Agent': 'FikishaCustomerWeb/1.0' } }
      );
      if (res.ok) {
        const data = await res.json() as { display_name?: string };
        if (data.display_name) {
          label = data.display_name.split(',')[0].trim() || 'Pinned location';
          address = data.display_name;
        }
      }
    } catch { /* keep defaults */ }

    const location: AppLocation = {
      id: crypto.randomUUID(),
      label,
      address,
      latitude: coords.lat,
      longitude: coords.lng,
      source: 'MAP',
      isSaved: saveCheckbox,
      updatedAt: Date.now(),
    };
    setActiveLocation(location, saveCheckbox);
    setShowMap(false);
    closeLocationSelector();
  };

  const handleActivateSaved = (location: AppLocation) => {
    setActiveLocation({ ...location, updatedAt: Date.now() }, false);
    closeLocationSelector();
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'current', label: 'GPS', icon: <Navigation size={15} /> },
    { key: 'search', label: 'Search', icon: <Search size={15} /> },
    { key: 'map', label: 'Map', icon: <MapPin size={15} /> },
    { key: 'saved', label: 'Saved', icon: <Bookmark size={15} /> },
  ];

  return (
    <>
      <div
        onClick={closeLocationSelector}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 1200, backdropFilter: 'blur(4px)',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: '460px',
        background: 'var(--surface)', zIndex: 1201,
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '20px 24px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 className="text-h2" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} color={ORANGE} />
              Delivery Location
            </h2>
            {activeLocation && (
              <p className="text-sm text-muted" style={{ margin: 0 }}>
                Active: <strong>{activeLocation.label}</strong>
              </p>
            )}
          </div>
          <button className="btn-icon" onClick={closeLocationSelector}>
            <X size={20} />
          </button>
        </div>

        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '12px 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontSize: '0.8rem', fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? ORANGE : BROWN_MUTED,
                borderBottom: tab === t.key ? `2px solid ${ORANGE}` : '2px solid transparent',
                background: 'transparent', cursor: 'pointer',
                transition: 'color 0.2s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tab !== 'saved' && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer', fontSize: '0.875rem', color: BROWN_MUTED,
            }}>
              <input
                type="checkbox"
                checked={saveCheckbox}
                onChange={e => setSaveCheckbox(e.target.checked)}
              />
              Save this location to my list
            </label>
          )}

          {tab === 'current' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '32px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: ORANGE_BG, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Navigation size={36} color={ORANGE} />
              </div>
              <p className="text-body" style={{ textAlign: 'center', color: BROWN_MUTED, maxWidth: '280px' }}>
                Use your device GPS to automatically detect your current location.
              </p>
              {gpsError && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-md)',
                  color: '#dc2626', fontSize: '0.875rem', width: '100%',
                }}>
                  {gpsError}
                </div>
              )}
              <button
                className="cl-btn-primary"
                onClick={handleUseGPS}
                disabled={isLocating}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
              >
                <Navigation size={16} />
                {isLocating ? 'Locating...' : 'Use My Current Location'}
              </button>
              <p className="text-sm" style={{ textAlign: 'center', color: BROWN_MUTED }}>
                If GPS is unavailable, use the <strong>Search</strong> or <strong>Map</strong> tab.
              </p>
            </div>
          )}

          {tab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="input-wrapper">
                <Search className="input-icon" size={18} />
                <input
                  type="text"
                  placeholder="Search address, area, or landmark..."
                  className="input-field"
                  style={{ padding: '12px 16px 12px 44px' }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {isSearching && (
                <p className="text-sm" style={{ color: BROWN_MUTED }}>Searching...</p>
              )}

              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSearchResult(result)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '12px 14px', background: 'var(--surface-hover)',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.15s',
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = ORANGE_BG; e.currentTarget.style.borderColor = ORANGE_BORDER; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      <MapPin size={16} color={ORANGE} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: BROWN_TEXT }}>{result.label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: BROWN_MUTED }}>
                          {result.address}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm" style={{ color: BROWN_MUTED }}>No results found. Try a different search term.</p>
              )}
            </div>
          )}

          {tab === 'map' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p className="text-sm" style={{ color: BROWN_MUTED }}>
                Click the button below to open the map and pin your delivery location.
              </p>
              <button
                className="cl-btn-primary"
                onClick={() => setShowMap(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
              >
                <MapPin size={16} />
                Open Map Picker
              </button>
              {activeLocation && (
                <div style={{
                  padding: '10px 14px', background: 'var(--surface-hover)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
                }}>
                  <p style={{ margin: 0, color: BROWN_MUTED, fontSize: '0.75rem' }}>Active location</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: BROWN_TEXT }}>{activeLocation.label}</p>
                  <p style={{ margin: '2px 0 0', color: BROWN_MUTED, fontSize: '0.8rem' }}>{activeLocation.address}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'saved' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedLocations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: BROWN_MUTED }}>
                  <Bookmark size={40} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                  <p className="text-body">No saved locations yet.</p>
                  <p className="text-sm">Select a location from another tab and check &ldquo;Save to my list&rdquo;.</p>
                </div>
              ) : (
                savedLocations.map(loc => (
                  <div
                    key={loc.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', background: 'var(--surface-hover)',
                      borderRadius: 'var(--radius-md)',
                      border: activeLocation?.id === loc.id ? `1px solid ${ORANGE}` : '1px solid transparent',
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '8px' }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: BROWN_TEXT }}>{loc.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: BROWN_MUTED }}>
                        {loc.address}
                      </p>
                      {loc.source && (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                          color: ORANGE, letterSpacing: '0.05em',
                        }}>
                          {loc.source}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleActivateSaved(loc)}
                        title="Use this location"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                          background: ORANGE, color: '#fff', cursor: 'pointer',
                        }}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => removeSavedLocation(loc.id)}
                        title="Delete"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(220,38,38,0.08)', color: '#dc2626', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showMap && (
        <LocationPickerMap
          initialCenter={activeLocation ? { lat: activeLocation.latitude, lng: activeLocation.longitude } : undefined}
          onCancel={() => setShowMap(false)}
          onConfirm={handleMapConfirm}
        />
      )}
    </>
  );
}
