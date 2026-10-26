import axios from 'axios';

/**
 * TOKEN STRATEGY:
 * We maintain the active JWT token in-memory and mirror it to sessionStorage for the
 * lifespan of the active browser tab/window.
 *
 * Security Considerations:
 * 1. Why NOT localStorage? localStorage persists indefinitely and across tabs, meaning a
 *    compromised third-party script or XSS can retrieve tokens long after a session ends.
 * 2. Why sessionStorage? It is destroyed automatically when the browser tab closes and is
 *    isolated to the current tab session.
 * 3. XSS / CSRF note: JavaScript-accessible tokens in sessionStorage are still vulnerable to
 *    in-tab XSS if an attacker executes arbitrary JS. True XSS-immunity requires httpOnly,
 *    SameSite cookies coupled with backend CSRF tokens.
 */
const TOKEN_STORAGE_KEY = 'eventflow_auth_token';

// In-memory token holder
let inMemoryToken = null;

// Callbacks for unauthorized (401) events (e.g. triggering logout in AuthContext)
let unauthorizedHandlers = [];

export const getStoredToken = () => {
  if (inMemoryToken) return inMemoryToken;
  try {
    const sessionToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (sessionToken) {
      inMemoryToken = sessionToken;
      return sessionToken;
    }
  } catch (err) {
    console.warn('[Storage Warning] Could not access sessionStorage:', err);
  }
  return null;
};

export const setStoredToken = (token) => {
  inMemoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[Storage Warning] Could not write to sessionStorage:', err);
  }
};

export const clearStoredToken = () => {
  inMemoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn('[Storage Warning] Could not remove from sessionStorage:', err);
  }
};

export const onUnauthorized = (handler) => {
  unauthorizedHandlers.push(handler);
  return () => {
    unauthorizedHandlers = unauthorizedHandlers.filter((h) => h !== handler);
  };
};

// Create Axios instance pointing to Vite dev proxy (/api)
const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Catch 401 Unauthorized (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Do not trigger logout callback for failed login attempts (which also return 401)
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/auth/login');
      if (!isLoginRequest) {
        clearStoredToken();
        unauthorizedHandlers.forEach((handler) => handler(error));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
