import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';

export type Role = 'ADMIN' | 'MERCHANT' | 'CUSTOMER' | 'DRIVER';

// This shape mirrors the authenticated user payload returned by the backend.
export interface User {
  id?: string;
  username?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  storeId?: string;
  driverId?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The customer app talks to the backend through the shared /api base path.
const API_URL = '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore the previous session on refresh so users stay signed in between page loads.
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fikisha_auth');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    // Persist auth changes immediately so the rest of the app can reload from storage if needed.
    if (user) {
      localStorage.setItem('fikisha_auth', JSON.stringify(user));
    } else {
      localStorage.removeItem('fikisha_auth');
    }
  }, [user]);

  const login = (nextUser: User) => {
    setUser(nextUser);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      return {
        ...currentUser,
        ...updates
      };
    });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    // Expose auth state and auth actions to any child component that needs them.
    <AuthContext.Provider value={{ user, login, updateUser, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Guard against using the hook outside the provider tree.
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export async function loginUser(username: string, password: string): Promise<{ token: string; user: User }> {
  // Customer/admin/merchant login shares the same backend endpoint.
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json') && res.status !== 204) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
    throw new Error('Login failed');
  }
  
  const data = await res.json();
  return { token: data.token, user: data.user };
}

export async function registerUser(username: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role: 'CUSTOMER' })
  });
  
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json') && res.status !== 204) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }
    throw new Error('Registration failed');
  }
  
  const data = await res.json();
  return { token: data.token, user: data.user };
}

export async function loginDriver(username: string, password: string): Promise<{ token: string; driver: any }> {
  // Drivers use a dedicated endpoint because their payload differs from the normal user login.
  const res = await fetch(`${API_URL}/drivers/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json') && res.status !== 204) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
    throw new Error('Login failed');
  }
  
  const data = await res.json();
  return { token: data.token, driver: data.driver };
}

export async function updateProfile(updates: {
  username?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
}): Promise<User> {
  // Read the token from persisted auth so profile updates stay authenticated after refreshes.
  const auth = JSON.parse(localStorage.getItem('fikisha_auth') || '{}');
  const res = await fetch(`${API_URL}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
    },
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json') && res.status !== 204) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update profile');
    }

    throw new Error('Failed to update profile');
  }

  return res.json();
}