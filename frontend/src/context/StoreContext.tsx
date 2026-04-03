import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getAuthHeaders as buildAuthHeaders } from '../utils/authStorage';

// Product and store types describe the API payloads shared across customer and merchant screens.
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  storeId?: string;
  available?: boolean;
}

export interface StoreOwner {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  storeId?: string | null;
}

export interface Store {
  id: string;
  name: string;
  rating: number;
  time: string;
  deliveryFee: number;
  category: string;
  image: string;
  description: string;
  address?: string | null;
  phone?: string | null;
  products: Product[];
  owner?: StoreOwner;
  isActive?: boolean;
  isOpen?: boolean;
  status?: string;
  bannerImage?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  streetAddress?: string | null;
  buildingNumber?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deliveryRadiusKm?: number | null;
  orderPreparationTimeMin?: number | null;
  minimumOrderAmount?: number | null;
  deliveryMethod?: string | null;
  deliveryFeeType?: string | null;
  deliveryFeeValue?: number | null;
  freeDeliveryThreshold?: number | null;
  allowPickup?: boolean;
  ownerIdDocument?: string | null;
  businessPermitDocument?: string | null;
  taxPin?: string | null;
  proofOfAddressDocument?: string | null;
  payoutMethod?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  mpesaNumber?: string | null;
  mpesaRegisteredName?: string | null;
  reviewNotes?: string | null;
  reviewRequestedDocs?: string | null;
  goLiveReady?: boolean;
  verificationCompleted?: boolean;
  payoutCompleted?: boolean;
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  confirmedAccurate?: boolean;
  confirmedAuthorization?: boolean;
  onboardingDraft?: string | null;
  openingHours?: { open: string; close: string };
  totalOrders?: number;
  totalRevenue?: number;
}

export interface CreateStoreInput {
  name: string;
  rating: number;
  time: string;
  deliveryFee: number;
  category: string;
  image: string;
  description: string;
  address?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  ownerName?: string;
  ownerUsername?: string;
  ownerPassword?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  bannerImage?: string;
  country?: string;
  city?: string;
  area?: string;
  streetAddress?: string;
  buildingNumber?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  deliveryRadiusKm?: number;
  openingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
  orderPreparationTimeMin?: number;
  minimumOrderAmount?: number;
  deliveryMethod?: 'PLATFORM_DRIVERS' | 'OWN_RIDERS' | 'BOTH';
  deliveryFeeType?: 'FIXED' | 'DISTANCE_BASED' | 'FREE_OVER_THRESHOLD';
  deliveryFeeValue?: number;
  freeDeliveryThreshold?: number;
  allowPickup?: boolean;
  ownerIdDocument?: string;
  businessPermitDocument?: string;
  taxPin?: string;
  proofOfAddressDocument?: string;
  payoutMethod?: 'BANK' | 'MPESA' | 'WALLET';
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  mpesaNumber?: string;
  mpesaRegisteredName?: string;
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  confirmedAccurate?: boolean;
  confirmedAuthorization?: boolean;
  onboardingCompleted?: boolean;
  onboardingDraft?: string;
}

export interface Category {
  id: string;
  name: string;
  image: string;
}

interface StoreContextType {
  stores: Store[];
  categories: Category[];
  addStore: (store: CreateStoreInput) => Promise<void>;
  updateStore: (id: string, updates: Partial<Store>) => Promise<void>;
  addProduct: (storeId: string, product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (storeId: string, productId: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (storeId: string, productId: string) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  reviewStore: (id: string, payload: { action: 'approve' | 'reject' | 'request_documents' | 'suspend' | 'activate'; reason?: string; requestedDocs?: string[] }) => Promise<void>;
  isLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// All store catalog requests are served from the same backend API namespace.
const API_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

function getAuthHeaders(): HeadersInit {
  // Reuse the saved auth token so privileged store/product mutations stay authorized.
  return buildAuthHeaders(true);
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  // Defensive parsing avoids runtime errors when the backend returns empty or non-JSON responses.
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text) as T;
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  // Prefer backend error text when available so the UI can show something more useful than a generic message.
  const payload = await readJsonSafely<{ error?: string; message?: string }>(response);
  return payload?.error || payload?.message || fallback;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load storefront data in parallel so the home screen can render stores and categories together.
        const [storesRes, catsRes] = await Promise.all([
          fetch(`${API_URL}/stores`),
          fetch(`${API_URL}/categories`)
        ]);

        let storesList: Store[] = [];
        if (storesRes.ok) {
          const storesPayload = await readJsonSafely<Store[] | { data: Store[] }>(storesRes);
          if (Array.isArray(storesPayload)) {
            storesList = storesPayload;
          } else if (storesPayload?.data) {
            storesList = storesPayload.data;
          }
          setStores(storesList);
        }

        // Build an emoji lookup from the predefined categories endpoint.
        const iconMap: Record<string, string> = {};
        if (catsRes.ok) {
          const categoriesPayload = await readJsonSafely<Category[]>(catsRes);
          if (categoriesPayload) {
            for (const c of categoriesPayload) {
              iconMap[c.name.toLowerCase()] = c.image;
            }
          }
        }

        // Derive displayable categories from actual store data so the filter chips
        // always match what's in the store list, enriched with emojis where available.
        const seen = new Set<string>();
        const derivedCategories: Category[] = [];
        for (const store of storesList) {
          if (store.category && !seen.has(store.category)) {
            seen.add(store.category);
            derivedCategories.push({
              id: store.category,
              name: store.category,
              image: iconMap[store.category.toLowerCase()] ?? '🏪',
            });
          }
        }
        setCategories(derivedCategories);
      } catch (error) {
        console.error("Failed to load data from backend server:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const addStore = async (store: CreateStoreInput) => {
    try {
      // After a successful create, merge the new store into local state to avoid a full refetch.
      const res = await fetch(`${API_URL}/stores`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(store)
      });

      if (res.ok) {
        const newStore = await readJsonSafely<Store>(res);
        if (!newStore) {
          return;
        }

        setStores(prev => [...prev, newStore]);
        return;
      }

      throw new Error(await getErrorMessage(res, 'Failed to add store'));
    } catch (error) {
      console.error("Failed to add store", error);
      throw error;
    }
  };

  const updateStore = async (id: string, updates: Partial<Store>) => {
    try {
      // Keep local state synchronized with the server response so admin views stay current.
      const res = await fetch(`${API_URL}/stores/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const updatedStore = await readJsonSafely<Store>(res);
        if (!updatedStore) {
          return;
        }

        setStores(prev => prev.map(s => s.id === id ? updatedStore : s));
        return;
      }

      throw new Error(await getErrorMessage(res, 'Failed to update store'));
    } catch (error) {
      console.error("Failed to update store", error);
      throw error;
    }
  };

  const addProduct = async (storeId: string, product: Omit<Product, 'id'>) => {
    try {
      // Product creation updates only the affected store to keep UI updates cheap and predictable.
      const res = await fetch(`${API_URL}/stores/${storeId}/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(product)
      });

      if (res.ok) {
        const newProduct = await readJsonSafely<Product>(res);
        if (!newProduct) {
          return;
        }

        setStores(prev => prev.map(store => {
          if (store.id === storeId) {
            return { ...store, products: [...(store.products || []), newProduct] };
          }
          return store;
        }));
        return;
      }

      throw new Error(await getErrorMessage(res, 'Failed to add product'));
    } catch (error) {
      console.error("Failed to add product", error);
      throw error;
    }
  };

  const updateProduct = async (storeId: string, productId: string, updates: Partial<Product>) => {
    try {
      // Replace just the edited product in state instead of reloading the full catalog.
      const res = await fetch(`${API_URL}/stores/${storeId}/products/${productId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const updatedProduct = await readJsonSafely<Product>(res);
        if (!updatedProduct) {
          return;
        }

        setStores(prev => prev.map(store => {
          if (store.id === storeId) {
            return {
              ...store,
              products: store.products.map((p: Product) => p.id === productId ? updatedProduct : p)
            };
          }
          return store;
        }));
        return;
      }

      throw new Error(await getErrorMessage(res, 'Failed to update product'));
    } catch (error) {
      console.error("Failed to update product", error);
      throw error;
    }
  };

  const deleteProduct = async (storeId: string, productId: string) => {
    try {
      // Remove the deleted product locally once the backend confirms the deletion.
      const res = await fetch(`${API_URL}/stores/${storeId}/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        setStores(prev => prev.map(store => {
          if (store.id === storeId) {
            return {
              ...store,
              products: store.products.filter((p: Product) => p.id !== productId)
            };
          }
          return store;
        }));
        return;
      }

      throw new Error(await getErrorMessage(res, 'Failed to delete product'));
    } catch (error) {
      console.error("Failed to delete product", error);
      throw error;
    }
  };

  const deleteStore = async (id: string) => {
    try {
      // Store deletion is reflected locally by filtering the removed store out of cached state.
      const res = await fetch(`${API_URL}/stores/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        setStores(prev => prev.filter(s => s.id !== id));
        return;
      }

      throw new Error(await getErrorMessage(res, 'Failed to delete store'));
    } catch (error) {
      console.error("Failed to delete store", error);
      throw error;
    }
  };

  const reviewStore = async (id: string, payload: { action: 'approve' | 'reject' | 'request_documents' | 'suspend' | 'activate'; reason?: string; requestedDocs?: string[] }) => {
    try {
      const res = await fetch(`${API_URL}/admin/stores/${id}/review`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updatedStore = await readJsonSafely<Store>(res);
        if (!updatedStore) {
          return;
        }
        setStores(prev => prev.map(s => s.id === id ? updatedStore : s));
        return;
      }

      const payloadData = await readJsonSafely<{
        error?: string;
        message?: string;
        details?: {
          missingRequirements?: string[];
          missingDocuments?: string[];
          missingPayoutFields?: string[];
          productCount?: number;
        };
      }>(res);

      const baseMessage = payloadData?.error || payloadData?.message || 'Failed to update store review state';
      const details = payloadData?.details;

      if (details && Array.isArray(details.missingRequirements) && details.missingRequirements.length > 0) {
        const parts: string[] = [];
        if (Array.isArray(details.missingDocuments) && details.missingDocuments.length > 0) {
          parts.push(`Missing docs: ${details.missingDocuments.join(', ')}`);
        }
        if (Array.isArray(details.missingPayoutFields) && details.missingPayoutFields.length > 0) {
          parts.push(`Missing payout fields: ${details.missingPayoutFields.join(', ')}`);
        }
        if (Number(details.productCount || 0) === 0) {
          parts.push('No products added');
        }
        throw new Error(parts.length > 0 ? `${baseMessage} ${parts.join(' | ')}` : baseMessage);
      }

      throw new Error(baseMessage);
    } catch (error) {
      console.error('Failed to review store', error);
      throw error;
    }
  };

  return (
    // Make shared catalog state available to the customer, merchant, and admin experiences.
    <StoreContext.Provider value={{ stores, categories, addStore, updateStore, addProduct, updateProduct, deleteProduct, deleteStore, reviewStore, isLoading }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreContext() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    // This guard makes setup mistakes fail loudly during development.
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  return context;
}