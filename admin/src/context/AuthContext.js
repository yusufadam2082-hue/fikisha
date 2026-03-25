import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Allow the admin portal to target either the deployed API URL or the local backend.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fikisha-sut2.onrender.com';

// A dedicated client keeps admin API configuration in one place.
const apiClient = axios.create({
  baseURL: API_BASE_URL
});

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
      // Fetch the current user so protected admin screens have the latest role/profile data.
      apiClient.get('/api/me')
        .then(res => {
          setUser(res.data);
        })
        .catch(err => {
          console.error('Failed to fetch user', err);
          localStorage.removeItem('token');
          delete apiClient.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    // Only admins are allowed into this portal, even if another role has valid credentials.
    const res = await apiClient.post('/api/auth/login', { username, password });
    const { token, user } = res.data;

    if (user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    localStorage.setItem('token', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
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