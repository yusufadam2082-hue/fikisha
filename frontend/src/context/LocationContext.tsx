import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppLocation {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  source: 'GPS' | 'SEARCH' | 'MAP' | 'MANUAL';
  isSaved?: boolean;
  updatedAt: number;
}

export interface DeliveryQuote {
  serviceable: boolean;
  reason?: string;
  storeId: string;
  zoneId?: string | null;
  zoneName?: string | null;
  deliveryFee: number;
  etaMinutes: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  distanceKm?: number | null;
  withinRadius?: boolean | null;
  withinPolygon?: boolean | null;
  minOrderValue?: number | null;
  orderValueValid: boolean;
}

export interface AddressSearchResult {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const ACTIVE_LOCATION_KEY = 'fikisha_active_location';
const SAVED_LOCATIONS_KEY = 'fikisha_saved_locations';

function loadActiveLocation(): AppLocation | null {
  try {
    const raw = localStorage.getItem(ACTIVE_LOCATION_KEY);
    return raw ? (JSON.parse(raw) as AppLocation) : null;
  } catch {
    return null;
  }
}

function loadSavedLocations(): AppLocation[] {
  try {
    const raw = localStorage.getItem(SAVED_LOCATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface LocationContextType {
  activeLocation: AppLocation | null;
  setActiveLocation: (location: AppLocation, saveToList?: boolean) => void;

  savedLocations: AppLocation[];
  saveLocation: (location: AppLocation) => void;
  removeSavedLocation: (id: string) => void;

  isLocating: boolean;
  useCurrentLocation: () => Promise<AppLocation | null>;

  searchAddresses: (query: string) => Promise<AddressSearchResult[]>;

  deliveryQuote: DeliveryQuote | null;
  isFetchingQuote: boolean;
  fetchDeliveryQuote: (storeId: string, orderTotal: number) => Promise<DeliveryQuote | null>;
  clearDeliveryQuote: () => void;

  isLocationSelectorOpen: boolean;
  openLocationSelector: () => void;
  closeLocationSelector: () => void;

  // Backward compat
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LocationProvider({ children }: { children: ReactNode }) {
  const [activeLocation, setActiveLocationState] = useState<AppLocation | null>(loadActiveLocation);
  const [savedLocations, setSavedLocations] = useState<AppLocation[]>(loadSavedLocations);
  const [isLocating, setIsLocating] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const quoteCache = useRef<Map<string, DeliveryQuote>>(new Map());

  const setActiveLocation = useCallback((location: AppLocation, saveToList = false) => {
    localStorage.setItem(ACTIVE_LOCATION_KEY, JSON.stringify(location));
    setActiveLocationState(location);
    setDeliveryQuote(null);
    quoteCache.current.clear();

    if (saveToList) {
      setSavedLocations(prev => {
        const normalized: AppLocation = { ...location, isSaved: true, updatedAt: Date.now() };
        const idx = prev.findIndex(l =>
          l.id === location.id ||
          l.address.toLowerCase() === location.address.toLowerCase()
        );
        const next = idx >= 0
          ? prev.map((l, i) => (i === idx ? normalized : l))
          : [normalized, ...prev].slice(0, 20);
        localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const saveLocation = useCallback((location: AppLocation) => {
    setSavedLocations(prev => {
      const normalized: AppLocation = { ...location, isSaved: true, updatedAt: Date.now() };
      const idx = prev.findIndex(l =>
        l.id === location.id ||
        l.address.toLowerCase() === location.address.toLowerCase()
      );
      const next = idx >= 0
        ? prev.map((l, i) => (i === idx ? normalized : l))
        : [normalized, ...prev].slice(0, 20);
      localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeSavedLocation = useCallback((id: string) => {
    setSavedLocations(prev => {
      const next = prev.filter(l => l.id !== id);
      localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const useCurrentLocation = useCallback(async (): Promise<AppLocation | null> => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    setIsLocating(true);
    try {
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          err => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
      });

      const { latitude, longitude } = coords;
      let label = 'Current Location';
      let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'User-Agent': 'FikishaCustomerWeb/1.0' } }
        );
        if (res.ok) {
          const data = await res.json() as { display_name?: string };
          if (data.display_name) {
            label = data.display_name.split(',')[0].trim() || 'Current Location';
            address = data.display_name;
          }
        }
      } catch { /* keep defaults */ }

      const location: AppLocation = {
        id: crypto.randomUUID(),
        label,
        address,
        latitude,
        longitude,
        source: 'GPS',
        updatedAt: Date.now(),
      };
      return location;
    } finally {
      setIsLocating(false);
    }
  }, []);

  const searchAddresses = useCallback(async (query: string): Promise<AddressSearchResult[]> => {
    if (!query.trim()) return [];
    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=8&addressdetails=1`,
        { headers: { 'User-Agent': 'FikishaCustomerWeb/1.0' } }
      );
      if (!res.ok) return [];
      const data = await res.json() as Array<{ lat: string; lon: string; display_name?: string }>;
      if (!Array.isArray(data)) return [];
      return data
        .filter(item => item.lat && item.lon)
        .map(item => ({
          label: (item.display_name || query).split(',')[0].trim() || 'Location',
          address: item.display_name || query,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }));
    } catch {
      return [];
    }
  }, []);

  const fetchDeliveryQuote = useCallback(async (
    storeId: string,
    orderTotal: number
  ): Promise<DeliveryQuote | null> => {
    const loc = activeLocation;
    if (!loc) return null;

    const key = `${storeId}:${loc.latitude.toFixed(5)}:${loc.longitude.toFixed(5)}:${Math.floor(orderTotal)}`;
    const cached = quoteCache.current.get(key);
    if (cached) {
      setDeliveryQuote(cached);
      return cached;
    }

    setIsFetchingQuote(true);
    try {
      const params = new URLSearchParams({
        storeId,
        lat: loc.latitude.toString(),
        lng: loc.longitude.toString(),
        orderTotal: orderTotal.toString(),
      });
      const res = await fetch(`/api/delivery/quote?${params.toString()}`);
      if (!res.ok) return null;
      const quote = (await res.json()) as DeliveryQuote;
      quoteCache.current.set(key, quote);
      setDeliveryQuote(quote);
      return quote;
    } catch {
      return null;
    } finally {
      setIsFetchingQuote(false);
    }
  }, [activeLocation]);

  const clearDeliveryQuote = useCallback(() => setDeliveryQuote(null), []);

  // Backward compat: derive address string from active location
  const deliveryAddress = activeLocation?.address
    ?? localStorage.getItem('fikisha_delivery_address')
    ?? '';

  const setDeliveryAddress = useCallback((address: string) => {
    localStorage.setItem('fikisha_delivery_address', address);
  }, []);

  return (
    <LocationContext.Provider value={{
      activeLocation,
      setActiveLocation,
      savedLocations,
      saveLocation,
      removeSavedLocation,
      isLocating,
      useCurrentLocation,
      searchAddresses,
      deliveryQuote,
      isFetchingQuote,
      fetchDeliveryQuote,
      clearDeliveryQuote,
      isLocationSelectorOpen,
      openLocationSelector: () => setIsLocationSelectorOpen(true),
      closeLocationSelector: () => setIsLocationSelectorOpen(false),
      deliveryAddress,
      setDeliveryAddress,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}