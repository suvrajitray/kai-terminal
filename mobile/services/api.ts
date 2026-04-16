import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { useAuthStore } from '../stores/auth-store';
import { useBrokerStore } from '../stores/broker-store';

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const upstox  = useBrokerStore.getState().getCredentials('upstox');
  const zerodha = useBrokerStore.getState().getCredentials('zerodha');

  if (upstox?.accessToken && upstox.accessToken !== 'NA') {
    config.headers['X-Upstox-Access-Token'] = upstox.accessToken;
  }
  if (zerodha?.accessToken && zerodha.accessToken !== 'NA') {
    config.headers['X-Zerodha-Access-Token'] = zerodha.accessToken;
    config.headers['X-Zerodha-Api-Key']      = zerodha.apiKey;
  }

  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    if (err.response?.status === 404) {
      console.warn('[API 404]', err.config?.method?.toUpperCase(), err.config?.url);
    }
    return Promise.reject(err);
  }
);
