import { idenplane } from '@/lib/idenplane';
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_BASE_URL ? `/${import.meta.env.VITE_BASE_URL.replace(/^\/|\/$/g, '')}/` : '/'}api`,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = idenplane.getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
