import axios from 'axios';

const DEFAULT_REMOTE_API_URL = 'https://mtaaexpress-sut2.onrender.com';
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const resolvedApiBaseUrl = process.env.REACT_APP_API_URL || (isLocalhost ? '' : DEFAULT_REMOTE_API_URL);

const apiClient = axios.create({
  baseURL: resolvedApiBaseUrl,
});

// Keep auth in one place so all admin pages send the same token automatically.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;