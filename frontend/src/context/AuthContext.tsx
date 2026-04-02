import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { clearStoredAuth, getStoredAuth, setStoredAuth } from '../utils/authStorage';

export type Role = 'ADMIN' | 'MERCHANT' | 'CUSTOMER' | 'DRIVER';

// This shape mirrors the authenticated user payload returned by the backend.
export interface User {
  id?: string;
  username?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  referralCode?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  role: Role;
  storeId?: string;
  driverId?: string;
  token?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
  country?: string | null;
  referralCode?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
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
const API_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore the previous session on refresh so users stay signed in between page loads.
  const [user, setUser] = useState<User | null>(() => {
    const saved = getStoredAuth<User>();
    return saved?.role ? saved : null;
  });

  useEffect(() => {
    // Persist auth changes immediately so the rest of the app can reload from storage if needed.
    if (user) {
      setStoredAuth(user);
    } else {
      clearStoredAuth();
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
  let res: Response;

  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  } catch {
    throw new Error('Could not reach the login service. Check the deployed backend URL and CORS configuration.');
  }
  
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

export async function registerUser(payload: RegisterPayload): Promise<{ token: string; user: User }> {
  let res: Response;

  try {
    res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error('Could not reach the registration service. Check the deployed backend URL and CORS configuration.');
  }
  
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
  let res: Response;

  try {
    res = await fetch(`${API_URL}/drivers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  } catch {
    throw new Error('Could not reach the driver login service. Check the deployed backend URL and CORS configuration.');
  }
  
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
  country?: string | null;
  referralCode?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  password?: string;
}): Promise<User> {
  // Read the token from persisted auth so profile updates stay authenticated after refreshes.
  const auth = getStoredAuth();
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