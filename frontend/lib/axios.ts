/**
 * PHTS System - Axios Instance Configuration
 *
 * Pre-configured axios instance with JWT token handling
 */

import axios from 'axios';

// Default to localhost backend during development
const DEFAULT_API_BASE = 'http://localhost:3001';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - Attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    if (globalThis.window !== undefined) {
      const token = globalThis.localStorage.getItem('phts_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      if (globalThis.window !== undefined) {
        globalThis.localStorage.removeItem('phts_token');
        globalThis.localStorage.removeItem('phts_user');
        globalThis.window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
