const AUTH_STORAGE_KEY = 'fikisha_auth';

export interface StoredAuth {
  token?: string;
}

export function getStoredAuth<T extends object = StoredAuth>(): T {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY);
    if (value) {
      return JSON.parse(value) as T;
    }
  } catch {
    // Fall through to empty auth payload.
  }

  return {} as T;
}

export function setStoredAuth<T extends object>(value: T): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Cleanup sessionStorage in case user was on the intermediate version
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthHeaders(includeContentType = true): HeadersInit {
  const auth = getStoredAuth();
  return {
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
  };
}
