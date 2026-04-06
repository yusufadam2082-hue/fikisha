import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import apiClient from '../utils/apiClient';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the admin session on refresh and verify that the token is still valid.
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Fetch the current user so protected admin screens have the latest role/profile data.
      apiClient.get('/api/me')
        .then(res => {
          setUser(res.data);
        })
        .catch(err => {
          console.error('Failed to fetch user', err);
          localStorage.removeItem('token');
          delete apiClient.defaults.headers.common['Authorization'];
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const normalizedUsername = String(username || '').trim();
    const isLegacyAdminUsername = normalizedUsername.toLowerCase() === 'admin';
    const normalizedPassword = isLegacyAdminUsername
      ? String(password || '').replace(/\s+/g, '')
      : String(password || '');

    let res;

    // Prefer RBAC admin session for legacy "admin" username so Super Admin-only
    // endpoints (roles/admin-users) work in the standalone portal too.
    if (isLegacyAdminUsername) {
      try {
        res = await apiClient.post('/api/admin/auth/login', {
          identifier: process.env.REACT_APP_ADMIN_EMAIL || 'admin@mtaaexpress.local',
          password: normalizedPassword
        });
      } catch {
        // Fall back to legacy username flow to preserve old standalone behavior.
        res = await apiClient.post('/api/auth/login', {
          username: normalizedUsername,
          password: normalizedPassword
        });
      }
    } else {
      res = await apiClient.post('/api/auth/login', {
        username: normalizedUsername,
        password: normalizedPassword
      });
    }

    const { token, user } = res.data;

    if (user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    localStorage.setItem('token', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    // Hold rendering until the token check finishes so routes do not flash in the wrong state.
    <AuthContext.Provider value={value}>
      {!loading ? children : null}
    </AuthContext.Provider>
  );
};