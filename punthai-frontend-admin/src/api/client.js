import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const raw = localStorage.getItem('adminData');
  if (raw) {
    const admin = JSON.parse(raw);
    config.headers['X-Admin-Id'] = admin.admin_id;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminData');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
