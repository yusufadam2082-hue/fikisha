const AUTH_STORAGE_KEY = 'fikisha_auth';

export interface StoredAuth {
  token?: string;
}

export function getStoredAuth<T extends object = StoredAuth>(): T {
  try {
    const sessionValue = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (sessionValue) {
      return JSON.parse(sessionValue) as T;
    }

    // One-time migration path from older localStorage-based auth.
    const legacyValue = localStorage.getItem(AUTH_STORAGE_KEY);
    if (legacyValue) {
      const parsed = JSON.parse(legacyValue) as T;
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch {
    // Fall through to empty auth payload.
  }

  return {} as T;
}

export function setStoredAuth<T extends object>(value: T): void {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

export function clearStoredAuth(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  // Cleanup legacy key if it exists from earlier versions.
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthHeaders(includeContentType = true): HeadersInit {
  const auth = getStoredAuth();
  return {
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
  };
}
